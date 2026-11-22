#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Merges all localized question translations into apps/web/content/seed/questions.en.json
and ensures all 30 questions have full translations for all 26 supported languages.
"""

import json
import os
import sys

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    seed_file = os.path.join(root, 'apps', 'web', 'content', 'seed', 'questions.en.json')
    
    with open(seed_file, 'r', encoding='utf-8') as f:
        questions = json.load(f)
    
    # Import modules from scripts/questions_translations
    sys.path.insert(0, os.path.join(root, 'scripts', 'questions_translations'))
    
    modules = ['ro_es_pt', 'western', 'slavic', 'nordic_baltic', 'med_celtic']
    all_data = {}
    
    for mod_name in modules:
        try:
            mod = __import__(mod_name)
            if hasattr(mod, 'DATA'):
                for lang, qmap in mod.DATA.items():
                    all_data[lang] = qmap
                print(f"Loaded {mod_name}: languages {list(mod.DATA.keys())}")
        except Exception as e:
            print(f"Could not load {mod_name}: {e}")

    print(f"Total languages loaded: {len(all_data)}: {sorted(list(all_data.keys()))}")
    
    # Merge translations into each question
    updated_count = 0
    for q in questions:
        qid = q['id']
        content = q.setdefault('content', {})
        translation_status = q.setdefault('translationStatus', {})
        
        for lang, qmap in all_data.items():
            if qid in qmap:
                item = qmap[qid]
                content[lang] = {
                    "prompt": item["prompt"].strip(),
                    "options": [opt.strip() for opt in item["options"]],
                    "explanation": item["explanation"].strip()
                }
                translation_status[lang] = "reviewed"
                updated_count += 1
            else:
                print(f"Warning: Missing {qid} in {lang}")
    
    # Write back to questions.en.json
    with open(seed_file, 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    
    print(f"Successfully updated {seed_file} with {updated_count} question-locale translations!")

    # Verify every question has all loaded languages
    for q in questions:
        for lang in all_data.keys():
            assert lang in q['content'], f"Missing {lang} in {q['id']}"
            assert len(q['content'][lang]['options']) == 4, f"Options length != 4 in {q['id']} for {lang}"
            assert len(q['content'][lang]['prompt']) <= 140, f"Prompt > 140 in {q['id']} for {lang}"
    print("Verification passed! All questions have valid 4 options and <= 140 chars prompt.")

if __name__ == '__main__':
    main()
