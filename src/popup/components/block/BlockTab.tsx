import { useBlockSettings } from "../../hooks/useBlockSettings";
import DomainBlocker from "./DomainBlocker";
import ContentFilterList from "./ContentFilterList";

export default function BlockTab() {
  const { blockSettings, addDomain, removeDomain, addFilter, removeFilter } = useBlockSettings();

  return (
    <div className="flex flex-col">
      <DomainBlocker
        domains={blockSettings.blockedDomains}
        onAdd={addDomain}
        onRemove={removeDomain}
      />
      <ContentFilterList
        filters={blockSettings.contentFilters}
        onAdd={addFilter}
        onRemove={removeFilter}
      />
    </div>
  );
}
