import { contextBridge, ipcRenderer } from 'electron';
import type { CornerbackDirectionAnalysisParams } from './components/cornerback-direction-analyzer';

contextBridge.exposeInMainWorld('movement', {
  analyse: (options?: Omit<CornerbackDirectionAnalysisParams, 'dataRoot'>) =>
    ipcRenderer.invoke('movement:analyse', options),
});
