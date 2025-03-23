import { FactionType } from "../../client/src/game/types";

export class Player {
  id: string;
  private username: string;
  private faction: FactionType | null;
  private ready: boolean;
  private resources: { food: number; ore: number };
  
  constructor(id: string, username: string) {
    this.id = id;
    this.username = username;
    this.faction = null;
    this.ready = false;
    this.resources = { food: 0, ore: 0 };
  }
  
  getUsername(): string {
    return this.username;
  }
  
  getFaction(): FactionType | null {
    return this.faction;
  }
  
  setFaction(faction: FactionType): void {
    this.faction = faction;
  }
  
  isReady(): boolean {
    return this.ready;
  }
  
  setReady(ready: boolean): void {
    this.ready = ready;
  }
  
  getResources(): { food: number; ore: number } {
    return { ...this.resources };
  }
  
  setResources(resources: { food: number; ore: number }): void {
    this.resources = { ...resources };
  }
  
  addResources(food: number, ore: number): void {
    this.resources.food += food;
    this.resources.ore += ore;
  }
  
  hasEnoughResources(food: number, ore: number): boolean {
    return this.resources.food >= food && this.resources.ore >= ore;
  }
  
  deductResources(food: number, ore: number): boolean {
    if (!this.hasEnoughResources(food, ore)) {
      return false;
    }
    
    this.resources.food -= food;
    this.resources.ore -= ore;
    return true;
  }
  
  toJSON(): any {
    return {
      id: this.id,
      username: this.username,
      faction: this.faction,
      ready: this.ready
    };
  }
}
