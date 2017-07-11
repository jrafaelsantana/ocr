import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { UploadComponent } from './upload/upload.component';
import { SocketService } from './socket.service';
import { FileUploadModule } from 'ng2-file-upload';


@NgModule({
  declarations: [
    AppComponent,
    UploadComponent,
  ],
  imports: [
    FileUploadModule,
    BrowserModule
  ],
  providers: [SocketService],
  bootstrap: [AppComponent]
})
export class AppModule { }
