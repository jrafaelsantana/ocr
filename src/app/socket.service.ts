import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Observable } from 'rxjs/Observable';
import * as io from 'socket.io-client';

@Injectable()
export class SocketService {

  private url = 'http://localhost:3000';
  private socket;
  emitEvent(name: string, data?: any) {
    if (data) {
      this.socket.emit(name, data);
    } else {
      this.socket.emit(name);
    }
  }
  receiveEvent() {
    const observable = new Observable(observer => {
      this.socket = io(this.url);
      this.socket.on('event', (data) => {
        observer.next(data);
      });
      return () => {
        this.socket.disconnect();
      };
    })
    return observable;
  }
}
