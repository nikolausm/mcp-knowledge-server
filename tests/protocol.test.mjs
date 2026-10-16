import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('the stdio server initializes and exposes the knowledge tools', async (t) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['dist/index.js'],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'protocol-test', version: '1.0.0' });
  t.after(async () => client.close());

  await client.connect(transport);
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
