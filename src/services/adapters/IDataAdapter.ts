import { ProjectData } from '../../types/projectSchema';

// Interface que todos los adapters deben cumplir
export interface IDataAdapter {
  name: string;
  
  // Lee datos de la fuente
  read(): Promise<ProjectData[]>;
  
  // Valida si los datos son correctos
  validate(data: any): Promise<boolean>;
}