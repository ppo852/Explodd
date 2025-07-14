declare module 'diskusage' {
  interface DiskUsageInfo {
    available: number;
    free: number;
    total: number;
  }

  function check(path: string): Promise<DiskUsageInfo>;
  
  export { check, DiskUsageInfo };
}
