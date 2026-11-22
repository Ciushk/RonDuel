#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Translations script for Nordic, Baltic, and Finno-Ugric languages:
- Swedish (sv)
- Danish (da)
- Norwegian Bokmål (nb)
- Finnish (fi)
- Estonian (et)
- Lithuanian (lt)
- Latvian (lv)
- Hungarian (hu)
"""

import os
import sys

# Ensure current directory is on sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from common import validate_and_save
from data_sv import SV_DATA
from data_da import DA_DATA
from data_nb import NB_DATA
from data_fi import FI_DATA
from data_et import ET_DATA
from data_lt import LT_DATA
from data_lv import LV_DATA
from data_hu import HU_DATA

LOCALES = {
    'sv': SV_DATA,
    'da': DA_DATA,
    'nb': NB_DATA,
    'fi': FI_DATA,
    'et': ET_DATA,
    'lt': LT_DATA,
    'lv': LV_DATA,
    'hu': HU_DATA,
}

def main():
    print("Processing Nordic, Baltic and Finno-Ugric translations...")
    for locale, data in LOCALES.items():
        validate_and_save(locale, data)
    print("All 8 locales processed successfully.")

if __name__ == '__main__':
    main()
