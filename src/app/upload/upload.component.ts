import { Component, OnInit, OnDestroy } from '@angular/core';
import { FileUploader } from 'ng2-file-upload';
import { SocketService } from '../socket.service';
import { ISubscription } from 'rxjs/Subscription';
const URL = 'http://localhost:3000/upload';

@Component({
  selector: 'app-upload',
  styleUrls: ['./upload.component.css'],
  templateUrl: './upload.component.html',
})
export class UploadComponent implements OnInit, OnDestroy {
  public uploader: FileUploader = new FileUploader({ url: URL });
  public hasBaseDropZoneOver = false;
  public fileStat: any = {};
  public disabled_order = undefined;
  public files_processed_count = 0;
  public files_uploaded_count = 0;
  public files_received_count = 0;
  private subscription: ISubscription;
  public fileOverBase(e) {
    this.hasBaseDropZoneOver = e;
  }
  filter_upload() {
    this.uploader.queue = this.uploader.queue.filter(item => (/\.(gif|jpe?g|png|webp|pdf)$/i.test(item['file']['name'])));
    console.log(this.uploader);
    this.uploader.uploadAll();
    this.files_uploaded_count = this.uploader.queue.length;
  }
  constructor(private socketService: SocketService) {
  }
  ngOnInit() {
    this.subscription = this.socketService.receiveEvent()
      .subscribe(data => {
        switch (data['event']) {
          case 'fileRecieved':
            this.files_received_count++;
            console.log('files_received_count: ' + this.files_received_count + data['file']);
            this.fileStat[data['file']] = {
              'stat': 'File Uploaded',
              'progress': 0
            };
            console.log(this.fileStat);
            if (this.files_received_count === this.files_uploaded_count) {
              console.log('process started');
              this.socketService.emitEvent('startProcess');
            }
            break;
          case 'checkStarted':
            this.disableUpload();
            console.log('now checking : ' + data['file']);
            this.setStatus(data['file'], '40', 'Checking');
            break;
          case 'startingOcr':
            console.log('startingOcr : ' + data['file']);
            this.setStatus(data['file'], '60', 'Processing');
            break;
          case 'ocrComplete':
            console.log('ocrComplete : ' + data['file']);
            this.files_processed_count += 1;
            this.setStatus(data['file'], '100', 'Complete');
            console.log('files_processed_count: ' + this.files_processed_count);
            if (this.files_processed_count === this.files_uploaded_count) {
              this.enableUpload();
            }
            break;
          case 'preOcred':
            console.log('preOcred : ' + data['file']);
            this.files_processed_count += 1;
            this.setStatus(data['file'], '100', 'Already Ocred');
            console.log('files_processed_count: ' + this.files_processed_count);
            if (this.files_processed_count === this.files_uploaded_count) {
              this.enableUpload();
            }
            break;
          case 'ocrError':
            alert(`Error:\n${JSON.stringify(data['error'])}\n\nReload the page to continue`);
            break;
          default:
            break;
        }
      });

  }
  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
  setStatus(file, progress, status) {
    this.fileStat[file]['stat'] = status;
    this.fileStat[file]['progress'] = progress;
  }
  enableUpload() {
    this.disabled_order = false;
    this.files_processed_count = 0;
    this.files_uploaded_count = 0;
    this.files_received_count = 0;
  }
  disableUpload() {
    this.disabled_order = true;
  }
  initDownload() {
    const link = document.createElement('a');
    link.href = 'http://mtcocr:3000/download';
    link.download = 'Ocred.zip';
    link.click();
  }
  reload() {
    window.location.reload(false);
  }
}
