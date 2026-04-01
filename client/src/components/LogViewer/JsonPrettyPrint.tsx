import { useLogStore } from "../../stores/logStore";

interface JsonPrettyPrintProps {
  data: any;
  parentPath?: string;
}

export default function JsonPrettyPrint({ data, parentPath = "" }: JsonPrettyPrintProps) {
  const addColumn = useLogStore((s) => s.addColumn);
  const addFilterFromValue = useLogStore((s) => s.addFilterFromValue);

  return (
    <div className="text-xs leading-relaxed">
      <JsonNode data={data} parentPath={parentPath} indent={0} addColumn={addColumn} addFilterFromValue={addFilterFromValue} />
    </div>
  );
}

interface JsonNodeProps {
  data: any;
  parentPath: string;
  indent: number;
  addColumn: (key: string) => void;
  addFilterFromValue: (key: string, value: string | number) => void;
}

function JsonNode({ data, parentPath, indent, addColumn, addFilterFromValue }: JsonNodeProps) {
  if (data === null) {
    return <span className="text-red-400">null</span>;
  }

  if (typeof data === "boolean") {
    return <span className="text-blue-400">{String(data)}</span>;
  }

  if (typeof data === "number") {
    return (
      <span
        className="group/val relative cursor-pointer text-orange-300 hover:underline"
        onClick={() => {
          if (parentPath) addFilterFromValue(parentPath, data);
        }}
      >
        {String(data)}
        {parentPath && <span className="pointer-events-none absolute -top-5 left-0 hidden whitespace-nowrap rounded bg-neutral-600 px-1.5 py-0.5 text-[10px] text-teal-300 shadow group-hover/val:inline-block">+ filter</span>}
      </span>
    );
  }

  if (typeof data === "string") {
    return (
      <span
        className="group/val relative cursor-pointer text-emerald-400 hover:underline"
        onClick={() => {
          if (parentPath) addFilterFromValue(parentPath, data);
        }}
      >
        &quot;{data}&quot;
        {parentPath && <span className="pointer-events-none absolute -top-5 left-0 hidden whitespace-nowrap rounded bg-neutral-600 px-1.5 py-0.5 text-[10px] text-teal-300 shadow group-hover/val:inline-block">+ filter</span>}
      </span>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-neutral-400">[]</span>;
    return (
      <span>
        <span className="text-neutral-400">[</span>
        {data.map((item, idx) => (
          <div key={idx} style={{ paddingLeft: `${(indent + 1) * 16}px` }}>
            <JsonNode
              data={item}
              parentPath={`${parentPath}[${idx}]`}
              indent={indent + 1}
              addColumn={addColumn}
              addFilterFromValue={addFilterFromValue}
            />
            {idx < data.length - 1 && <span className="text-neutral-500">,</span>}
          </div>
        ))}
        <div style={{ paddingLeft: `${indent * 16}px` }}>
          <span className="text-neutral-400">]</span>
        </div>
      </span>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data);
    if (entries.length === 0) return <span className="text-neutral-400">{"{}"}</span>;
    return (
      <span>
        <span className="text-neutral-400">{"{"}</span>
        {entries.map(([key, value], idx) => {
          const fullPath = parentPath ? `${parentPath}.${key}` : key;
          return (
            <div key={key} style={{ paddingLeft: `${(indent + 1) * 16}px` }}>
              <span
                className="group/key relative cursor-pointer text-purple-400 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  addColumn(fullPath);
                }}
              >
                &quot;{key}&quot;
                <span className="pointer-events-none absolute -top-5 left-0 hidden whitespace-nowrap rounded bg-neutral-600 px-1.5 py-0.5 text-[10px] text-teal-300 shadow group-hover/key:inline-block">+ column</span>
              </span>
              <span className="text-neutral-400">: </span>
              <JsonNode
                data={value}
                parentPath={fullPath}
                indent={indent + 1}
                addColumn={addColumn}
                addFilterFromValue={addFilterFromValue}
              />
              {idx < entries.length - 1 && <span className="text-neutral-500">,</span>}
            </div>
          );
        })}
        <div style={{ paddingLeft: `${indent * 16}px` }}>
          <span className="text-neutral-400">{"}"}</span>
        </div>
      </span>
    );
  }

  return <span className="text-neutral-400">{String(data)}</span>;
}
