export interface Pg
{
  id: number;
  name: string;
  description: string;
  hp : number;
  atk : number;
  def : number;
  spd : number;
  imageUrl: string;
  actionsName: string[];
  equipmentsName: string[];
  enumType: string;
}
