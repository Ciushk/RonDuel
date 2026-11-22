#!/usr/bin/env python3
import json
import os
import sys

sys.path.insert(0, '.')
from scripts.locales.base import EN_DATA, RO_DATA
from scripts.locales.west_eu import DATA as WEST_EU
from scripts.locales.slavic import DATA as SLAVIC
from scripts.locales.nordic_baltic import DATA as NORDIC_BALTIC
from scripts.locales.med_celtic import DATA as MED_CELTIC

ALL_LOCALES = {
    'en': EN_DATA,
    'ro': RO_DATA,
    **WEST_EU,
    **SLAVIC,
    **NORDIC_BALTIC,
    **MED_CELTIC,
}

def set_nested(d, dot_key, value):
    parts = dot_key.split('.')
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value

MESSAGES_DIR = 'apps/web/messages'

for loc, trans_dict in ALL_LOCALES.items():
    file_path = os.path.join(MESSAGES_DIR, f'{loc}.json')
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        data = {}

    for dot_key, val in trans_dict.items():
        set_nested(data, dot_key, val)

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

print(f"Applied 311 keys across all {len(ALL_LOCALES)} message files!")
