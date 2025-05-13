import { Injectable } from '@angular/core';
import {GameState} from '../model/GameState';
import {HttpClient} from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class GameStateService {

  gameState : GameState | null = null;

  constructor(private http: HttpClient)
  {
  }

  iniziaGame(listaId: number[]) {
    return this.http.post<GameState>("/api/start", listaId);
  }

}
