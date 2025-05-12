import { Component } from '@angular/core';
import {Pg} from '../../../model/Pg';
import {PgRepositoryService} from '../../../services/pg-repository.service';
import * as Console from 'node:console';
import {Monster} from '../../../model/Monster';
import {MonsterRepositoryService} from '../../../services/monster-repository.service';

@Component({
  selector: 'app-glossary',
  imports: [],
  templateUrl: './glossary.component.html',
  styleUrl: './glossary.component.css'
})
export class GlossaryComponent
{
  personaggi: Pg[] = [];
  mostri: Monster[] = [];

  constructor(private pgRepo:PgRepositoryService,
              private monsterRepo:MonsterRepositoryService)
  {
    pgRepo.getAllPgs().subscribe(resp=> this.personaggi = resp);
    Console.log("Personaggi caricati nel costruttore: ", this.personaggi)

    monsterRepo.getAllMonsters().subscribe(resp=> this.mostri = resp);
    Console.log("Mostri caricati nel costruttore: ", this.mostri)
  }
}
