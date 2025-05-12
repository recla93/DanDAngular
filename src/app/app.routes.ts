import { Routes } from '@angular/router';
import {HomepageComponent} from '../components/masterPage/homepage/homepage.component';
import {SelectorPgComponent} from '../components/gameArch/selector-pg/selector-pg.component';
import {GlossaryComponent} from '../components/gameArch/glossary/glossary.component';

export const routes: Routes =
[
  {path: '',component: HomepageComponent},
  {path: 'selezione', component: SelectorPgComponent},
  {path: 'glossario', component: GlossaryComponent},
];
