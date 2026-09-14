"""Translate the EXIF enum values the metadata reader produces.

`formatExifValue` returns tokens such as 'rotated90', 'centerWeighted' or
'aperturePriority' for tags whose raw value is a code. The metadata tool
renders those tokens through `imageMeta.v_<token>` so they are readable in
both locales. Idempotent — existing keys are never overwritten.

Run with:  python3 scripts/i18n/exif-values.py
"""

import json

EN = {
    'v_normal': 'Normal (0°)',
    'v_mirrored': 'Mirrored horizontally',
    'v_rotated180': 'Rotated 180°',
    'v_mirroredVertical': 'Mirrored vertically',
    'v_mirroredRotated90': 'Mirrored, rotated 90° clockwise',
    'v_rotated90': 'Rotated 90° clockwise',
    'v_mirroredRotated270': 'Mirrored, rotated 270° clockwise',
    'v_rotated270': 'Rotated 270° clockwise',
    'v_noFlash': 'Flash did not fire',
    'v_flashFired': 'Flash fired',
    'v_flashNotFired': 'Flash present but did not fire',
    'v_notDefined': 'Not defined',
    'v_manual': 'Manual',
    'v_program': 'Program (auto)',
    'v_aperturePriority': 'Aperture priority',
    'v_shutterPriority': 'Shutter priority',
    'v_creative': 'Creative',
    'v_action': 'Action',
    'v_portrait': 'Portrait',
    'v_landscape': 'Landscape',
    'v_unknown': 'Unknown',
    'v_average': 'Average',
    'v_centerWeighted': 'Centre-weighted',
    'v_spot': 'Spot',
    'v_multiSpot': 'Multi-spot',
    'v_pattern': 'Pattern',
    'v_partial': 'Partial',
    'v_dpiCm': 'pixels per cm',
    'v_dpi': 'pixels per inch (dpi)',
    'v_none': 'Not specified',
    'v_srgb': 'sRGB',
    'v_uncalibrated': 'Uncalibrated',
    'v_auto': 'Auto',
    'v_bracket': 'Auto bracket',
}

AR = {
    'v_normal': 'طبيعي (0°)',
    'v_mirrored': 'معكوس أفقيًا',
    'v_rotated180': 'مدوّر 180°',
    'v_mirroredVertical': 'معكوس رأسيًا',
    'v_mirroredRotated90': 'معكوس ومدوّر 90° باتجاه عقارب الساعة',
    'v_rotated90': 'مدوّر 90° باتجاه عقارب الساعة',
    'v_mirroredRotated270': 'معكوس ومدوّر 270° باتجاه عقارب الساعة',
    'v_rotated270': 'مدوّر 270° باتجاه عقارب الساعة',
    'v_noFlash': 'لم يعمل الفلاش',
    'v_flashFired': 'عمل الفلاش',
    'v_flashNotFired': 'فلاش موجود ولم يعمل',
    'v_notDefined': 'غير محدد',
    'v_manual': 'يدوي',
    'v_program': 'تلقائي (برنامج)',
    'v_aperturePriority': 'أولوية فتحة العدسة',
    'v_shutterPriority': 'أولوية سرعة الغالق',
    'v_creative': 'إبداعي',
    'v_action': 'حركة',
    'v_portrait': 'بورتريه',
    'v_landscape': 'منظر طبيعي',
    'v_unknown': 'غير معروف',
    'v_average': 'متوسط',
    'v_centerWeighted': 'متوسط مركزي',
    'v_spot': 'نقطة',
    'v_multiSpot': 'نقاط متعددة',
    'v_pattern': 'نمط',
    'v_partial': 'جزئي',
    'v_dpiCm': 'بكسل لكل سنتيمتر',
    'v_dpi': 'بكسل لكل بوصة (dpi)',
    'v_none': 'غير محددة',
    'v_srgb': 'sRGB',
    'v_uncalibrated': 'غير معاير',
    'v_auto': 'تلقائي',
    'v_bracket': 'تعريض متعدد',
}


def merge(path, values):
    data = json.load(open(path, encoding='utf-8'))
    node = data.setdefault('imageMeta', {})
    added = 0
    for key, value in values.items():
        if key in node:
            print('skip (exists):', key)
            continue
        node[key] = value
        added += 1
    json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    open(path, 'a', encoding='utf-8').write('\n')
    print(path, '->', added, 'keys added')


merge('messages/en.json', EN)
merge('messages/ar.json', AR)
print('done')
