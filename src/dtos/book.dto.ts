class ChapterDto {
  id: string;
  title: string;
  order: number;
  contentUrl: string;
  bookId: string;
  createdAt: Date;
  updatedAt: Date;
  constructor(model: any) {
    this.id = model.id;
    this.title = model.title;
    this.order = model.order;
    this.contentUrl = model.contentUrl;
    this.bookId = model.bookId;
    this.createdAt = model.createdAt;
    this.updatedAt = model.updatedAt;
  }
}

export { ChapterDto };
