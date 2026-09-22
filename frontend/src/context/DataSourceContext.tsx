import React, { createContext, useContext, useState, useEffect } from 'react';

export type DataSource = 'LEGACY_API' | 'ML_MODEL';

interface DataSourceContextType {
  dataSource: DataSource;
  setDataSource: (source: DataSource) => void;
}

const DataSourceContext = createContext<DataSourceContextType | undefined>(undefined);

export function DataSourceProvider({ children }: { children: React.ReactNode }) {
  const [dataSource, setDataSource] = useState<DataSource>(() => {
    return (localStorage.getItem('heatzone_datasource') as DataSource) || 'LEGACY_API';
  });

  useEffect(() => {
    localStorage.setItem('heatzone_datasource', dataSource);
  }, [dataSource]);

  return (
    <DataSourceContext.Provider value={{ dataSource, setDataSource }}>
      {children}
    </DataSourceContext.Provider>
  );
}

export function useDataSource() {
  const context = useContext(DataSourceContext);
  if (context === undefined) {
    throw new Error('useDataSource must be used within a DataSourceProvider');
  }
  return context;
}
