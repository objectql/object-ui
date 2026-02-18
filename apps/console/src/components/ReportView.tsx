import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ReportViewer, ReportBuilder } from '@object-ui/plugin-report';
import { Empty, EmptyTitle, EmptyDescription, Button } from '@object-ui/components';
import { PenLine, ChevronLeft, BarChart3, Loader2 } from 'lucide-react';
import { MetadataToggle, MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { useMetadata } from '../context/MetadataProvider';
import type { DataSource } from '@object-ui/types';

// Mock fields for the builder since we don't have a dynamic schema provider here yet
const MOCK_FIELDS = [
  { name: 'month', label: 'Month', type: 'string' },
  { name: 'revenue', label: 'Revenue', type: 'number' },
  { name: 'count', label: 'Count', type: 'number' },
  { name: 'region', label: 'Region', type: 'string' },
  { name: 'product', label: 'Product', type: 'string' },
  { name: 'source', label: 'Lead Source', type: 'string' },
  { name: 'stage', label: 'Stage', type: 'string' },
  { name: 'amount', label: 'Amount', type: 'currency' },
];

export function ReportView({ dataSource }: { dataSource?: DataSource }) {
  const { reportName } = useParams<{ reportName: string }>();
  const { showDebug, toggleDebug } = useMetadataInspector();
  const [isEditing, setIsEditing] = useState(false);
  
  // Find report definition from API-driven metadata
  const { reports, loading } = useMetadata();
  const initialReport = reports?.find((r: any) => r.name === reportName);
  const [reportData, setReportData] = useState(initialReport);

  // State for report runtime data
  const [reportRuntimeData, setReportRuntimeData] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Sync reportData when metadata finishes loading or reportName changes
  useEffect(() => {
    setReportData(initialReport);
  }, [initialReport]);

  // Load report runtime data when report definition changes
  useEffect(() => {
    if (!reportData || !dataSource) {
      setReportRuntimeData([]);
      return;
    }

    // If report has inline data, use it directly
    if (reportData.data && Array.isArray(reportData.data)) {
      setReportRuntimeData(reportData.data);
      return;
    }

    // If report has a dataSource config, fetch data using it
    if (reportData.dataSource) {
      const fetchDataFromSource = async () => {
        setDataLoading(true);
        try {
          // Use the dataSource configuration to fetch data
          const resource = reportData.dataSource.object || reportData.dataSource.resource;
          if (!resource) {
            console.warn('ReportView: dataSource missing object/resource property');
            setReportRuntimeData([]);
            return;
          }

          const result = await dataSource.find(resource, {
            $filter: reportData.dataSource.filter,
            $orderby: reportData.dataSource.sort,
            $top: reportData.dataSource.limit,
          });

          setReportRuntimeData(result.data || []);
        } catch (error) {
          console.error('ReportView: Failed to load data from dataSource', error);
          setReportRuntimeData([]);
        } finally {
          setDataLoading(false);
        }
      };

      fetchDataFromSource();
      return;
    }

    // If report has an objectName, fetch data from that object
    if (reportData.objectName) {
      const fetchDataFromObject = async () => {
        setDataLoading(true);
        try {
          const result = await dataSource.find(reportData.objectName, {
            $filter: reportData.filters,
            $orderby: reportData.sort,
            $top: reportData.limit || 100, // Default limit to avoid fetching too much data
          });

          setReportRuntimeData(result.data || []);
        } catch (error) {
          console.error('ReportView: Failed to load data from objectName', error);
          setReportRuntimeData([]);
        } finally {
          setDataLoading(false);
        }
      };

      fetchDataFromObject();
      return;
    }

    // No data source configured
    setReportRuntimeData([]);
  }, [reportData, dataSource]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!initialReport) {
    return (
      <div className="h-full flex items-center justify-center p-8">
         <Empty>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <BarChart3 className="h-6 w-6 text-muted-foreground" />
          </div>
          <EmptyTitle>Report Not Found</EmptyTitle>
          <EmptyDescription>
            The report &quot;{reportName}&quot; could not be found.
            It may have been removed or renamed.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const handleSave = (newReport: any) => {
    console.log('Saving report:', newReport);
    setReportData(newReport);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
         <div className="flex items-center p-3 sm:p-4 border-b bg-muted/10 gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="shrink-0">
               <ChevronLeft className="h-4 w-4 mr-1" />
               <span className="hidden sm:inline">Back to View</span>
               <span className="sm:hidden">Back</span>
            </Button>
            <div className="font-medium truncate">Edit Report: {reportData.title}</div>
         </div>
         <div className="flex-1 overflow-auto">
            <ReportBuilder 
               schema={{ 
                  title: 'Report Builder', 
                  report: reportData,
                  availableFields: MOCK_FIELDS,
                  onSave: handleSave,
                  onCancel: () => setIsEditing(false)
               }} 
            />
         </div>
      </div>
    );
  }

  // Wrap the report definition in the ReportViewer schema
  // The ReportViewer expects a schema property which is of type ReportViewerSchema
  // That schema has a 'report' property which is the actual report definition (ReportSchema)
  const viewerSchema = {
      type: 'report-viewer',
      report: reportData, // The report definition
      data: reportRuntimeData, // Runtime data fetched from the data source
      showToolbar: true,
      allowExport: true,
      loading: dataLoading, // Loading state for data fetching
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-4 p-4 sm:p-6 border-b shrink-0 bg-muted/10">
        <div className="min-w-0">
           {/* Header is handled by ReportViewer usually, but we can have a page header too */}
           <h1 className="text-base sm:text-lg font-medium text-muted-foreground truncate">{reportData.title || 'Report Viewer'}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
           <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-8">
              <PenLine className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Edit Report</span>
           </Button>
           <MetadataToggle open={showDebug} onToggle={toggleDebug} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-row relative">
         <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 bg-muted/5">
            <div className="max-w-5xl mx-auto shadow-sm border rounded-lg sm:rounded-xl bg-background overflow-hidden min-h-150">
                <ReportViewer schema={viewerSchema} />
            </div>
         </div>

         <MetadataPanel
            open={showDebug}
            sections={[{ title: 'Report Configuration', data: reportData }]}
         />
      </div>
    </div>
  );
}
