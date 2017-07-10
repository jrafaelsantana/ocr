import { OcrPage } from './app.po';

describe('ocr App', () => {
  let page: OcrPage;

  beforeEach(() => {
    page = new OcrPage();
  });

  it('should display welcome message', done => {
    page.navigateTo();
    page.getParagraphText()
      .then(msg => expect(msg).toEqual('Welcome to app!!'))
      .then(done, done.fail);
  });
});
