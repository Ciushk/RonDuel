#!/usr/bin/env python3
"""
Translations for Slavic languages in RonDuel:
Polish (pl), Czech (cs), Slovak (sk), Bulgarian (bg), Croatian (hr), Slovenian (sl), and Ukrainian (uk).
"""

import os
import sys

# Ensure local translations module can be imported regardless of execution working directory
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, '..', '..'))

if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from common import validate_and_save
from slavic_pl import pl
from slavic_cs import cs
from slavic_sk import sk
from slavic_bg import bg
from slavic_hr import hr
from slavic_sl import sl
from slavic_uk import uk

TRANSLATIONS = {
    'pl': pl,
    'cs': cs,
    'sk': sk,
    'bg': bg,
    'hr': hr,
    'sl': sl,
    'uk': uk,
}

def main():
    for locale, data in TRANSLATIONS.items():
        validate_and_save(locale, data)

if __name__ == '__main__':
    main()
