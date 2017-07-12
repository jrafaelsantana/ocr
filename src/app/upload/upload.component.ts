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
  public disabled_order: boolean = undefined;
  public files_processed_count = 0;
  public files_uploaded_count = 0;
  public files_received_count = 0;
  private subscription: ISubscription;
  private connection: boolean = undefined;
  constructor(private socketService: SocketService) {
  }
  ngOnInit() {
    this.subscription = this.socketService.receiveEvent()
      .subscribe(data => {
        switch (data['event']) {
          case 'connect_established':
            console.log('connected');
            this.connection = true;
            break;
          case 'fileRecieved':
            this.files_received_count++;
            this.fileStat[data['file']] = {
              'stat': 'Uploaded',
              'progress': 0
            };
            if (this.files_received_count === this.files_uploaded_count) {
              this.socketService.emitEvent('startProcess');
            }
            break;
          case 'checkStarted':
            this.disableUpload();
            this.setStatus(data['file'], '40', 'Checking');
            break;
          case 'startingOcr':
            this.setStatus(data['file'], '60', 'Processing');
            break;
          case 'ocrComplete':
            this.files_processed_count += 1;
            this.setStatus(data['file'], '100', 'Complete');
            if (this.files_processed_count === this.files_uploaded_count) {
              this.enableUpload();
            }
            break;
          case 'preOcred':
            this.files_processed_count += 1;
            this.setStatus(data['file'], '100', 'Already Ocred');
            if (this.files_processed_count === this.files_uploaded_count) {
              this.enableUpload();
            }
            break;
          case 'ocrError':
            this.handle_error(JSON.stringify(data['error']));
            break;
          default:
            break;
        }
      });

  }
  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
  public fileOverBase(e) {
    this.hasBaseDropZoneOver = e;
  }
  filter_upload() {
    if (this.connection === true) {
      this.uploader.queue = this.uploader.queue.filter(item => (/\.(gif|jpe?g|png|webp|pdf)$/i.test(item['file']['name'])));
      this.uploader.uploadAll();
      this.files_uploaded_count = this.uploader.queue.length;
    } else {
      this.handle_error('Connection Unstable');
    }
  }
  setStatus(file, progress, status) {
    this.fileStat[file]['stat'] = status;
    this.fileStat[file]['progress'] = progress;
  }
  handle_error(error) {
    if (confirm(`Error:${error}\nPage will be reloaded.`)) {
      this._reload();
    } else {
      alert('Please reload the page to continue');
      this.disableUpload();
    };
  }
  enableUpload() {
    this.disabled_order = false;
    this.files_processed_count = 0;
    this.files_uploaded_count = 0;
    this.files_received_count = 0;
    alert('Converted files are ready to download');
  }
  disableUpload() {
    this.disabled_order = true;
  }
  initDownload() {
    const link = document.getElementById('download');
    link.setAttribute('href', 'http://mtcocr:3000/download');
    link.click();
  }
  _reload() {
    window.location.reload(false);
  }
}
