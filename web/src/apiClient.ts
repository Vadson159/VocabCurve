export async function apiFsRead(path: string): Promise<string | null> {
  try {
    const res = await fetch('/api/fs/read', { method: 'POST', body: JSON.stringify({ path }) });
    const data = await res.json();
    return data.content || null;
  } catch (e) {
    return null;
  }
}

export async function apiFsWrite(path: string, content: string): Promise<boolean> {
  try {
    const res = await fetch('/api/fs/write', { method: 'POST', body: JSON.stringify({ path, content }) });
    const data = await res.json();
    return data.success;
  } catch (e) {
    return false;
  }
}

export async function apiFsExists(path: string): Promise<boolean> {
  try {
    const res = await fetch('/api/fs/exists', { method: 'POST', body: JSON.stringify({ path }) });
    const data = await res.json();
    return data.exists;
  } catch (e) {
    return false;
  }
}

export async function apiFsDelete(path: string): Promise<boolean> {
  try {
    const res = await fetch('/api/fs/delete', { method: 'POST', body: JSON.stringify({ path }) });
    const data = await res.json();
    return data.success;
  } catch (e) {
    return false;
  }
}

export async function apiFsCopy(src: string, dst: string): Promise<boolean> {
  try {
    const res = await fetch('/api/fs/copy', { method: 'POST', body: JSON.stringify({ src, dst }) });
    const data = await res.json();
    return data.success;
  } catch (e) {
    return false;
  }
}

export async function apiFsReaddir(path: string): Promise<string[]> {
  try {
    const res = await fetch('/api/fs/readdir', { method: 'POST', body: JSON.stringify({ path }) });
    const data = await res.json();
    return data.files || [];
  } catch (e) {
    return [];
  }
}

export async function apiExec(cmd: string): Promise<{error: string | null, stdout: string, stderr: string}> {
  try {
    const res = await fetch('/api/exec', { method: 'POST', body: JSON.stringify({ cmd }) });
    return await res.json();
  } catch (e: any) {
    return { error: e.message, stdout: '', stderr: '' };
  }
}

export async function apiDialog(): Promise<string[]> {
  try {
    const res = await fetch('/api/dialog', { method: 'POST', body: '{}' });
    const data = await res.json();
    return data.paths || [];
  } catch (e) {
    return [];
  }
}
