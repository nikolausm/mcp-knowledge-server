import assert from 'node:assert/strict';
import test from 'node:test';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = fileURLToPath(new URL('../', import.meta.url));

async function isolatedServer(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'knowledge-protocol-'));
  const database = path.join(directory, 'knowledge', 'knowledge.json');
  let client;
  t.after(async () => {
    try { await client?.close(); }
    finally { await rm(directory, { recursive: true, force: true }); }
  });
  await mkdir(path.join(directory, 'dist'));
  await mkdir(path.dirname(database));
  await writeFile(database, JSON.stringify({ entries: [] }));
  await copyFile(path.join(root, 'dist', 'index.js'), path.join(directory, 'dist', 'index.mjs'));
  await symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(directory, 'dist', 'index.mjs')],
    cwd: directory,
    env: { PATH: process.env.PATH },
    stderr: 'pipe',
  });
  client = new Client({ name: 'protocol-test', version: '1.0.0' });
  await client.connect(transport);
  return { client, database };
}

test('the stdio server initializes and exposes the knowledge tools', async (t) => {
  const { client } = await isolatedServer(t);
  const response = await client.listTools();

  assert.deepEqual(
    response.tools.map((tool) => tool.name),
    [
      'store_knowledge',
      'retrieve_knowledge',
      'update_knowledge',
      'delete_knowledge',
      'list_categories',
    ],
  );
});

test('all five tools round-trip synthetic knowledge in an isolated database', async t => {
  const { client, database } = await isolatedServer(t);
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args });
    assert.notEqual(result.isError, true);
    return result.content[0].text;
  };
  const original = { category: 'synthetic', title: 'Fixture', content: 'Synthetic text', tags: ['demo'] };
  assert.deepEqual(JSON.parse(await call('retrieve_knowledge')), []);
  const stored = await call('store_knowledge', original);
  const id = stored.match(/ID: (\d+)$/)?.[1];
  assert.ok(id);
  const [entry] = JSON.parse(await call('retrieve_knowledge', { query: 'fixture', category: 'synthetic', tags: ['demo'] }));
  assert.equal(entry.id, id);
  for (const [key, value] of Object.entries(original)) assert.deepEqual(entry[key], value);
  assert.deepEqual(JSON.parse(await call('list_categories')), ['synthetic']);
  await call('update_knowledge', { id, content: 'Updated synthetic text', tags: ['changed'] });
  const updated = JSON.parse(await call('retrieve_knowledge', { tags: ['changed'] }));
  assert.equal(updated.length, 1);
  assert.equal(updated[0].content, 'Updated synthetic text');
  assert.equal(updated[0].title, original.title);
  assert.deepEqual(JSON.parse(await readFile(database, 'utf8')).entries, updated);
  await call('delete_knowledge', { id });
  assert.deepEqual(JSON.parse(await call('retrieve_knowledge')), []);
  assert.deepEqual(JSON.parse(await call('list_categories')), []);
  assert.deepEqual(JSON.parse(await readFile(database, 'utf8')), { entries: [] });
  await assert.rejects(client.callTool({ name: 'delete_knowledge', arguments: { id } }), /nicht gefunden/);
});
