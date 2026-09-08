import { build } from 'esbuild';

let moduleId = 0;

export async function loadModule(entryPoint) {
  const result = await build({
    entryPoints: [entryPoint], bundle: true, write: false,
    format: 'esm', platform: 'node', target: 'node18',
  });
  const source = `${result.outputFiles[0].text}\n// test module ${moduleId++}`;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
