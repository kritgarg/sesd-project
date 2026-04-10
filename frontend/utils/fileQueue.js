export class FileQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  add(file) {
    this.queue.push(file);
  }

  next() {
    return this.queue.shift();
  }

  hasItems() {
    return this.queue.length > 0;
  }
}
