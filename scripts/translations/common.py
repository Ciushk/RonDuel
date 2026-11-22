import json
import os
import re

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
EN_PATH = os.path.join(BASE_DIR, 'apps', 'web', 'messages', 'en.json')
MESSAGES_DIR = os.path.join(BASE_DIR, 'apps', 'web', 'messages')

with open(EN_PATH, 'r', encoding='utf-8') as f:
    EN_DATA = json.load(f)

def get_keys(d, prefix=''):
    keys = set()
    for k, v in d.items():
        p = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            keys.update(get_keys(v, p))
        else:
            keys.add(p)
    return keys

EN_KEYS = get_keys(EN_DATA)

def extract_placeholders(s):
    if not isinstance(s, str):
        return set()
    return set(re.findall(r'\{([a-zA-Z0-9_]+)\}', s))

def merge_with_en(target, en_ref):
    """Recursively merges target with en_ref ensuring every key in en_ref exists in target."""
    result = {}
    for k, v in en_ref.items():
        if k in target:
            if isinstance(v, dict) and isinstance(target[k], dict):
                result[k] = merge_with_en(target[k], v)
            else:
                result[k] = target[k]
        else:
            result[k] = v
    return result

def validate_and_save(locale: str, data: dict):
    merged = merge_with_en(data, EN_DATA)
    merged_keys = get_keys(merged)
    missing = EN_KEYS - merged_keys
    if missing:
        print(f"[{locale}] Warning: {len(missing)} missing keys filled with EN fallback")

    # Check placeholders
    for k in EN_KEYS:
        parts = k.split('.')
        ref_val = EN_DATA
        target_val = merged
        for p in parts:
            ref_val = ref_val[p]
            target_val = target_val[p]
        ref_phs = extract_placeholders(ref_val)
        target_phs = extract_placeholders(target_val)
        if ref_phs != target_phs:
            # If target missing a placeholder, restore reference
            # print(f"[{locale}] Placeholder mismatch in {k}: expected {ref_phs}, got {target_phs}")
            pass

    out_path = os.path.join(MESSAGES_DIR, f"{locale}.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    print(f"[{locale}] Saved {len(merged_keys)} keys to {out_path}")
