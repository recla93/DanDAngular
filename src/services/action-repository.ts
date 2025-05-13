import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Action} from 'rxjs/internal/scheduler/Action';
import {Actions} from '../model/Actions';
import {GameStateService} from './game-state.service';

@Injectable({
  providedIn: 'root'
})
export class ActionRepositoryService {

  constructor(private http: HttpClient,private gsService:GameStateService) { }


  getActionByPgId(id: number)
  {
    //solo per prova

    this.gsService.gameState!.currentEntity = id;
    return this.http.post<Actions[]>('api/start/action',this.gsService.gameState)
  }
}
