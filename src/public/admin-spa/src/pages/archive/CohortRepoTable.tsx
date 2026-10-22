import type { CohortRepo } from '../../lib/types.js';
import { Table, TableFrame, TBody, Td, Th, THead, Tr } from '../../components/ui/Table.js';
import type { CohortRepoEditor, CohortRepoFieldEditor } from './useCohortRepoEditor.js';
import { TextLink } from '../../components/ui/TextLink.js';

// 숫자 칸(순서·레벨): 누르면 입력칸으로 바뀐다
function NumberCell({
  cr,
  field,
  display,
  title,
}: {
  cr: CohortRepo;
  field: CohortRepoFieldEditor;
  display: string | number;
  title: string;
}) {
  return field.editingId === cr.id ? (
    <input
      ref={field.inputRef}
      type="number"
      value={field.value}
      onChange={(e) => field.setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') field.save(cr);
        if (e.key === 'Escape') field.cancel();
      }}
      className="border border-primary-300 rounded px-1 py-0.5 text-xs w-14 text-center focus:outline-none focus:ring-1 focus:ring-primary-400"
    />
  ) : (
    <button
      onClick={() => field.start(cr)}
      className="text-xs text-base-600 font-mono hover:text-primary-600 hover:underline px-1"
      title={title}
    >
      {display}
    </button>
  );
}

export function CohortRepoTable({ repos, editor }: { repos: CohortRepo[]; editor: CohortRepoEditor }) {
  return (
    <TableFrame>
      <Table>
        <THead>
          <tr>
            <Th>순서</Th>
            <Th>레포</Th>
            <Th>트랙</Th>
            <Th>레벨</Th>
            <Th>작업</Th>
          </tr>
        </THead>
        <TBody>
          {repos.map((cr) => (
            <Tr key={cr.id}>
              <Td>
                <NumberCell cr={cr} field={editor.order} display={cr.order} title="클릭하여 순서 변경" />
              </Td>
              <Td>
                <TextLink
                  href={cr.missionRepo.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium"
                >
                  {cr.missionRepo.name}
                </TextLink>
              </Td>
              <Td className="text-xs text-base-600">{cr.missionRepo.track ?? '—'}</Td>
              <Td>
                <NumberCell cr={cr} field={editor.level} display={cr.level ?? '—'} title="클릭하여 레벨 변경" />
              </Td>
              <Td>
                <button
                  onClick={() => void editor.remove(cr)}
                  disabled={editor.isRemoving}
                  className="text-xs text-base-400 hover:text-danger-500 disabled:opacity-40 px-1"
                  title="삭제"
                >
                  ✕
                </button>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableFrame>
  );
}
