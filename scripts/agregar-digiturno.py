"""Agrega la exportación de turnos de Digiturno en src/data/historico.json.

Uso:
    python scripts/agregar-digiturno.py "Historicos Turnos MAY2026.xlsx" [--out src/data/historico.json]

Entrada: libro de Excel con una fila por servicio atendido (columnas NombreOficina, Fecha.1,
TiempoEspera, TiempoAtencion, Estado, IdUsuario, TiempoInicioAtencion, ...).
Salida: SOLO agregados por oficina y hora. No se escribe ningún dato personal: ni identificación de
usuarios, ni contratos, ni nombres ni códigos de operadores.

Después de agregar, ejecuta `node scripts/calibrar-kappa.mjs` para recalibrar la disponibilidad κ.
Requiere: pandas y openpyxl.
"""
import argparse
import json
import os
import unicodedata

import pandas as pd

# Oficinas: id corto, nombre, ciudad y coordenadas (para calcular distancias de traslado).
META = {
    'cartagena': ('ctg', 'Cartagena', 'Cartagena', 10.4236, -75.5478),
    'monteria': ('mon', 'Montería', 'Montería', 8.7479, -75.8814),
    'sincelejo': ('sin', 'Sincelejo', 'Sincelejo', 9.3047, -75.3978),
    'cerete': ('cer', 'Cereté', 'Cereté', 8.8856, -75.7919),
    'turbaco': ('tur', 'Turbaco', 'Turbaco', 10.3333, -75.4167),
    'magangue': ('mag', 'Magangué', 'Magangué', 9.2417, -74.7547),
    'sahagun': ('sah', 'Sahagún', 'Sahagún', 8.9467, -75.4467),
    'corozal': ('cor', 'Corozal', 'Corozal', 9.3186, -75.2931),
    'carmen de bolivar': ('car', 'El Carmen de Bolívar', 'El Carmen', 9.7186, -75.1211),
    'lorica': ('lor', 'Lorica', 'Lorica', 9.2394, -75.8143),
    'mompox': ('mpx', 'Mompox', 'Mompox', 9.2418, -74.4258),
    'caucasia': ('cau', 'Caucasia', 'Caucasia', 7.9847, -75.1953),
    'tolu': ('tol', 'Tolú', 'Tolú', 9.5226, -75.5819),
    'planeta rica': ('plr', 'Planeta Rica', 'Planeta Rica', 8.4096, -75.5855),
}
HORAS = list(range(7, 17))


def norm(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower()
    return s.replace('oficina surtigas - ', '').replace('sede ', '').strip()


def parse_dt(s):
    if not isinstance(s, str):
        return pd.NaT
    return pd.to_datetime(s.strip().replace('a. m.', 'AM').replace('p. m.', 'PM'), format='%d/%m/%Y %I:%M:%S %p', errors='coerce')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('xlsx')
    ap.add_argument('--out', default='src/data/historico.json')
    a = ap.parse_args()

    df = pd.read_excel(a.xlsx, sheet_name=0)
    df['t'] = df['Fecha.1'].map(parse_dt)
    df['ta'] = df['TiempoInicioAtencion'].map(parse_dt)
    df['date'] = df.t.dt.date
    df['h'] = df.t.dt.hour
    df['ha'] = df.ta.dt.hour
    df['o'] = df['NombreOficina'].map(norm)
    desconocidas = sorted(set(df.o) - set(META))
    if desconocidas:
        raise SystemExit(f'Oficinas sin metadatos en META: {desconocidas}')

    atendidos = df[df.TiempoAtencion > 0]
    dias = df.groupby('o').date.nunique()
    prev = {}
    if os.path.exists(a.out):
        prev = {o['id']: o for o in json.load(open(a.out, encoding='utf-8')).get('offices', [])}

    oficinas = []
    for key, g in df.groupby('o'):
        id_, nombre, ciudad, lat, lon = META[key]
        f = atendidos[atendidos.o == key]
        nd = int(dias[key])
        fechas = sorted(g.date.unique())
        ops_dia = f.groupby('date').IdUsuario.nunique().reindex(fechas).fillna(0).mean()
        lam = [round(len(g[g.h == h]) / nd, 2) for h in HORAS]
        c_hist = [round(f[f.ha == h].groupby('date').IdUsuario.nunique().reindex(fechas).fillna(0).mean(), 2) for h in HORAS]
        wait_obs = [round(g[g.h == h].TiempoEspera.mean() / 60, 1) if (g.h == h).any() else 0 for h in HORAS]
        oficinas.append({
            'id': id_, 'name': nombre, 'city': ciudad, 'lat': lat, 'lon': lon,
            'staff': max(1, round(ops_dia)), 'opsDia': round(float(ops_dia), 2), 'opsMes': int(g.IdUsuario.nunique()),
            'mu': round(3600 / f.TiempoAtencion.mean(), 2), 'atencMin': round(f.TiempoAtencion.mean() / 60, 1),
            'turnosDia': round(len(g) / nd, 1),
            'aba': round((g.Estado == 'ABA').mean() * 100, 1), 'can': round((g.Estado == 'CAN').mean() * 100, 1),
            'esperaMed': round(g.TiempoEspera.median() / 60, 1), 'esperaP90': round(g.TiempoEspera.quantile(.9) / 60, 1),
            'esperaMedia': round(g.TiempoEspera.mean() / 60, 1),
            'lam': lam, 'cHist': c_hist, 'waitObs': wait_obs,
            'kappa': prev.get(id_, {}).get('kappa'),  # se recalcula con calibrar-kappa.mjs
        })
    oficinas.sort(key=lambda o: -o['turnosDia'])

    # Demanda relativa por día de la semana (lunes=0).
    por_dia = df.groupby('date').size().reset_index(name='n')
    por_dia['dow'] = pd.to_datetime(por_dia.date).dt.dayofweek
    media = por_dia.n.mean()
    dow = {str(d): round(float(g.n.mean() / media), 2) for d, g in por_dia.groupby('dow') if d < 5}

    op_oficinas = atendidos.groupby('IdUsuario').o.nunique()
    doc = {
        'fuente': 'Digiturno · Histórico de turnos (agregado, sin datos personales)',
        'periodo': f"{df.t.min().date()} a {df.t.max().date()}",
        'diasHabiles': int(df.date.nunique()),
        'turnos': int(len(df)),
        'operadoresUnicos': int(atendidos.IdUsuario.nunique()),
        'operadoresPorDiaRed': round(float(atendidos.groupby('date').IdUsuario.nunique().mean()), 1),
        'operadoresEnVariasOficinas': int((op_oficinas > 1).sum()),
        'esperaMediaMin': round(df.TiempoEspera.mean() / 60, 1),
        'pctEspera30': round((df.TiempoEspera > 1800).mean() * 100, 1),
        'pctEspera60': round((df.TiempoEspera > 3600).mean() * 100, 1),
        'abandonoPct': round((df.Estado == 'ABA').mean() * 100, 1),
        'canceladoPct': round((df.Estado == 'CAN').mean() * 100, 1),
        'atencionMediaMin': round(atendidos.TiempoAtencion.mean() / 60, 1),
        'horas': HORAS,
        'dow': dow,
        'offices': oficinas,
    }
    prev_doc = json.load(open(a.out, encoding='utf-8')) if os.path.exists(a.out) else {}
    if 'calibracion' in prev_doc:
        doc['calibracion'] = prev_doc['calibracion']
    json.dump(doc, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"{a.out}: {doc['turnos']} turnos, {len(oficinas)} oficinas, {doc['operadoresUnicos']} operadores (solo agregados)")


if __name__ == '__main__':
    main()
