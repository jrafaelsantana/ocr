#!/usr/bin/env python
import sys

import fitz


class ocr_check:
    def __init__(self, file_name):
        self.name = file_name
        self.ascii = 0
        self.non_ascii = 0
        self.doc = None

    def _check_(self):
        self.doc = fitz.open(self.name)
        if len(self.doc) > 20:
            pages = 19
        else:
            pages = len(self.doc)

        for i in range(pages):
            text = self.doc.getPageText(i)
            for index, item in enumerate(text):
                try:
                    item.decode('ascii')
                    self.ascii += 1
                except UnicodeError:
                    self.non_ascii += 1

    def is_ocred(self):
        self._check_()
        if self.non_ascii > self.ascii:
            return False
        else:
            return True


if __name__ == "__main__":
    print ocr_check(sys.argv[1]).is_ocred()
    sys.stdout.flush()
