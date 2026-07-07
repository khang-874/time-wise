import { useBlockSettings } from "../../hooks/useBlockSettings";
import DomainBlocker from "./DomainBlocker";
import ContentFilterList from "./ContentFilterList";
import ImportExportControls from "./ImportExportControls";
import ShortsToggle from "./ShortsToggle";

export default function BlockTab() {
  const {
    blockSettings,
    addDomain,
    removeDomain,
    requestRemoveDomain,
    cancelRemoveDomain,
    addFilter,
    removeFilter,
    requestRemoveFilter,
    cancelRemoveFilter,
    importSettings,
    setBlockYoutubeShorts,
  } = useBlockSettings();

  return (
    <div className="flex flex-col">
      <ImportExportControls blockSettings={blockSettings} onImport={importSettings} />
      <ShortsToggle enabled={blockSettings.blockYoutubeShorts} onChange={setBlockYoutubeShorts} />
      <DomainBlocker
        domains={blockSettings.blockedDomains}
        onAdd={addDomain}
        onRemove={removeDomain}
        onRequestRemove={requestRemoveDomain}
        onCancelRemove={cancelRemoveDomain}
      />
      <ContentFilterList
        filters={blockSettings.contentFilters}
        onAdd={addFilter}
        onRemove={removeFilter}
        onRequestRemove={requestRemoveFilter}
        onCancelRemove={cancelRemoveFilter}
      />
    </div>
  );
}
