"""Strings for the Text Frequency Counter tool (English + Arabic).

Idempotent: existing keys are never overwritten.
Run with:  python3 scripts/i18n/frequency-counter.py
"""

import json

EN = {
    'tools': {
        'text-frequency-counter': {
            'name': 'Text Frequency Counter',
            'short': 'Rank every word and character by how often it appears.',
            'description': 'Free online frequency counter. Rank words or characters by how often they appear, filter stop words and short terms, and export the table as CSV or JSON — all locally in your browser.',
            'intro': 'See which words and letters carry the weight of a text. Every term is listed with its count and its share of the whole text, so you can spot repeated words, check keyword density before publishing, or study letter frequency in any language.',
            'howTo': [
                'Paste or type your text.',
                'Choose whether to rank words or characters.',
                'Filter out common words, short terms or numbers as needed.',
                'Copy the table or download it as CSV or JSON.',
            ],
            'faqs': [
                {
                    'q': 'How is this different from the Word Counter?',
                    'a': 'The Word Counter reports totals — words, characters, sentences, reading time. This tool answers a different question: which terms repeat, how often, and how much of the text they cover. It ranks every term instead of the ten most frequent ones.',
                },
                {
                    'q': 'What does the coverage number mean?',
                    'a': 'It is the share of all counted terms that the rows currently shown account for. If the top 25 words cover 41%, the rest of your text is spread across many rarer words.',
                },
                {
                    'q': 'How are characters counted?',
                    'a': 'Letters and digits only — spaces, punctuation and emoji are skipped because they would fill the table with noise. With "Ignore letter case" on, "E" and "e" are merged into one row.',
                },
                {
                    'q': 'Can I use it for keyword density or SEO?',
                    'a': 'Yes. Rank words with common words removed to see what a page talks about most, or check that a target keyword is not repeated past the point of looking stuffed.',
                },
            ],
        },
    },
    'textTools': {
        'freqOptionsTitle': 'Frequency options',
        'freqMode': 'Rank',
        'freqModeWords': 'Words',
        'freqModeWordsHint': 'Rank word forms, ignoring punctuation.',
        'freqModeCharacters': 'Characters',
        'freqModeCharactersHint': 'Rank letters and digits.',
        'freqSortLabel': 'Order',
        'freqSortCount': 'Most frequent',
        'freqSortAlpha': 'A → Z',
        'freqListSize': 'Rows to show',
        'freqShowTop': 'Top {count}',
        'freqShowAll': 'Every term',
        'freqMinLength': 'Minimum word length',
        'freqLenPlus': '{count}+ letters',
        'freqIgnoreCase': 'Ignore letter case',
        'freqIgnoreCaseHint': 'Merge "The" and "the" into one row.',
        'freqIgnoreStopWords': 'Ignore common words',
        'freqStopHint_en': 'Removes English stop words such as the, and, of.',
        'freqStopHint_ar': 'Removes Arabic stop words such as في, من, على.',
        'freqIncludeNumbers': 'Include numbers',
        'freqIncludeNumbersHint': 'Count digit-only terms such as years and IDs.',
        'freqWordsCounted': 'Words counted',
        'freqCharsCounted': 'Characters counted',
        'freqUnique': 'Unique terms',
        'freqOnce': 'Seen once',
        'freqCoverage': 'Rows coverage',
        'freqCoverageHint': 'Share of the text the rows above account for.',
        'freqTableTitle': 'Frequency table',
        'freqShown': '{shown} of {total} terms shown',
        'freqTerm': 'Term',
        'freqCount': 'Count',
        'freqPercent': 'Percent',
        'freqCopyTable': 'Copy table',
        'freqCopyJson': 'Copy JSON',
        'freqDownloadCsv': 'Download CSV',
        'freqEmptyState': 'Paste some text above — every word or character is then ranked here by how often it appears.',
    },
}

AR = {
    'tools': {
        'text-frequency-counter': {
            'name': 'عداد تكرار النصوص',
            'short': 'رتّب الكلمات والحروف حسب عدد مرات ظهورها.',
            'description': 'احسب تكرار الكلمات والحروف أونلاين مجانًا. رتّب الكلمات أو الحروف حسب عدد مرات ظهورها، مع تجاهل الكلمات الشائعة والتصدير بصيغة CSV أو JSON — كل ذلك داخل متصفحك.',
            'intro': 'اعرف ما يتكرر في النص فعليًا. يظهر كل عنصر بعدد مرات ظهوره ونسبته من النص كاملًا، لتكتشف الكلمات المكررة، أو تقيس كثافة الكلمات المفتاحية قبل النشر، أو تدرس تكرار الحروف في أي لغة.',
            'howTo': [
                'الصق النص أو اكتبه.',
                'اختر الترتيب حسب الكلمات أو الحروف.',
                'استبعد الكلمات الشائعة أو القصيرة أو الأرقام حسب الحاجة.',
                'انسخ الجدول أو حمّله بصيغة CSV أو JSON.',
            ],
            'faqs': [
                {
                    'q': 'ما الفرق بينه وبين عداد الكلمات؟',
                    'a': 'عداد الكلمات يعرض الإجماليات: عدد الكلمات والأحرف والجمل وزمن القراءة. هذه الأداة تجيب على سؤال مختلف: أي العناصر تتكرر، وكم مرة، وما نسبة النص التي تغطيها، فهي ترتب كل العناصر لا أكثر عشرة فقط.',
                },
                {
                    'q': 'ما معنى نسبة «تغطية الصفوف»؟',
                    'a': 'هي نسبة ما تمثله الصفوف المعروضة من مجموع العناصر المحسوبة. إذا كانت أعلى 25 كلمة تغطي 41%، فباقي النص موزع على كلمات نادرة كثيرة.',
                },
                {
                    'q': 'كيف تُحسب الأحرف؟',
                    'a': 'الحروف والأرقام فقط — تُستثنى المسافات وعلامات الترقيم والرموز لأنها تملأ الجدول بما لا يفيد. عند تشغيل «تجاهل حالة الأحرف» يُدمج الحرفان E و e في صف واحد.',
                },
                {
                    'q': 'هل يمكن استخدامه لقياس كثافة الكلمات المفتاحية؟',
                    'a': 'نعم. رتّب الكلمات مع استبعاد الشائعة لترى موضوع الصفحة الأساسي، أو تأكد من أن الكلمة المستهدفة لا تتكرر بشكل يبدو مبالغًا فيه.',
                },
            ],
        },
    },
    'textTools': {
        'freqOptionsTitle': 'خيارات التكرار',
        'freqMode': 'الترتيب حسب',
        'freqModeWords': 'الكلمات',
        'freqModeWordsHint': 'ترتيب الكلمات مع تجاهل علامات الترقيم.',
        'freqModeCharacters': 'الحروف',
        'freqModeCharactersHint': 'ترتيب الحروف والأرقام.',
        'freqSortLabel': 'نوع الترتيب',
        'freqSortCount': 'الأكثر تكرارًا',
        'freqSortAlpha': 'أ → ي',
        'freqListSize': 'عدد الصفوف',
        'freqShowTop': 'أعلى {count}',
        'freqShowAll': 'كل العناصر',
        'freqMinLength': 'أقل طول للكلمة',
        'freqLenPlus': '{count} أحرف أو أكثر',
        'freqIgnoreCase': 'تجاهل حالة الأحرف',
        'freqIgnoreCaseHint': 'دمج «The» و «the» في صف واحد.',
        'freqIgnoreStopWords': 'تجاهل الكلمات الشائعة',
        'freqStopHint_en': 'يحذف كلمات التوقف الإنجليزية مثل the و and و of.',
        'freqStopHint_ar': 'يحذف كلمات التوقف العربية مثل في و من و على.',
        'freqIncludeNumbers': 'تضمين الأرقام',
        'freqIncludeNumbersHint': 'حساب العناصر الرقمية مثل السنوات والمعرّفات.',
        'freqWordsCounted': 'الكلمات المحسوبة',
        'freqCharsCounted': 'الأحرف المحسوبة',
        'freqUnique': 'عناصر فريدة',
        'freqOnce': 'ظهرت مرة واحدة',
        'freqCoverage': 'تغطية الصفوف',
        'freqCoverageHint': 'نسبة النص التي تمثلها الصفوف أعلاه.',
        'freqTableTitle': 'جدول التكرار',
        'freqShown': '{shown} من {total} عنصرًا',
        'freqTerm': 'العنصر',
        'freqCount': 'العدد',
        'freqPercent': 'النسبة',
        'freqCopyTable': 'نسخ الجدول',
        'freqCopyJson': 'نسخ JSON',
        'freqDownloadCsv': 'تحميل CSV',
        'freqEmptyState': 'الصق نصًا أعلاه — سيظهر هنا ترتيب كل كلمة أو حرف حسب عدد مرات ظهوره.',
    },
}


def merge(path, payload):
    data = json.load(open(path, encoding='utf-8'))
    added = 0
    for section, values in payload.items():
        node = data.setdefault(section, {})
        for key, value in values.items():
            if key in node:
                print('skip (exists):', f'{section}.{key}')
                continue
            node[key] = value
            added += 1
    json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    open(path, 'a', encoding='utf-8').write('\n')
    print(path, '->', added, 'keys added')


merge('messages/en.json', EN)
merge('messages/ar.json', AR)
print('done')
