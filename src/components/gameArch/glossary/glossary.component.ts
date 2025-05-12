import { Component } from '@angular/core';
import {Pg} from '../../../model/Pg';
import {PgRepositoryService} from '../../../services/pg-repository.service';
import {Monster} from '../../../model/Monster';
import {MonsterRepositoryService} from '../../../services/monster-repository.service';
import {NgForOf} from "@angular/common";

@Component({
  selector: 'app-glossary',
  imports: [
    NgForOf
  ],
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

    monsterRepo.getAllMonsters().subscribe(resp=> this.mostri = resp);

    this.personaggi = this.personaggi.map(p => ({...p, flipped: false }));
  }

}
