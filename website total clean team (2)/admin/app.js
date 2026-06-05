// =====================================================================
// Admin app — login + CRUD for portfolio_items and machines
// =====================================================================
(function () {
  const sb = window.supabaseClient;

  // ---- shared helpers ----------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const show = (el) => el.classList.add('show');
  const hide = (el) => el.classList.remove('show');
  function setMsg(el, text) {
    if (!text) { el.textContent = ''; hide(el); return; }
    el.textContent = text; show(el);
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  async function uploadImage(bucket, file) {
    const ext = (file.name.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}${ext}`;
    const { error } = await sb.storage.from(bucket).upload(path, file, {
      cacheControl: '3600', upsert: false,
      contentType: file.type || 'application/octet-stream'
    });
    if (error) throw error;
    const { data } = sb.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }
  function deriveStoragePath(publicUrl, bucket) {
    // publicUrl looks like: https://xxx.supabase.co/storage/v1/object/public/<bucket>/<path>
    const marker = `/object/public/${bucket}/`;
    const i = publicUrl.indexOf(marker);
    return i === -1 ? null : publicUrl.slice(i + marker.length);
  }

  // ---- auth gate ---------------------------------------------------------
  const loginWrap = $('loginWrap');
  const shell = $('shell');
  const who = $('who');
  const logoutBtn = $('logoutBtn');

  function setSignedIn(session) {
    if (session) {
      loginWrap.style.display = 'none';
      shell.classList.add('show');
      who.textContent = session.user.email || '';
      logoutBtn.style.display = '';
      loadPortfolio();
      loadMachines();
    } else {
      loginWrap.style.display = '';
      shell.classList.remove('show');
      who.textContent = '';
      logoutBtn.style.display = 'none';
    }
  }

  sb.auth.getSession().then(({ data }) => setSignedIn(data.session));
  sb.auth.onAuthStateChange((_evt, session) => setSignedIn(session));

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('loginErr');
    setMsg(err, '');
    const btn = $('loginBtn');
    btn.disabled = true; btn.textContent = 'Bejelentkezés…';
    try {
      const { error } = await sb.auth.signInWithPassword({
        email: $('loginEmail').value.trim(),
        password: $('loginPwd').value
      });
      if (error) throw error;
    } catch (ex) {
      setMsg(err, ex.message || 'Hibás bejelentkezés.');
    } finally {
      btn.disabled = false; btn.textContent = 'Belépés';
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await sb.auth.signOut();
  });

  // ---- tabs --------------------------------------------------------------
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.pane').forEach(p => p.classList.remove('show'));
      document.getElementById('pane-' + tab.dataset.tab).classList.add('show');
    });
  });

  // ---- drop-zone wiring (shared) ----------------------------------------
  function wireDrop(dropId, fileId, nameId, previewId) {
    const drop = $(dropId);
    const file = $(fileId);
    const name = $(nameId);
    const preview = $(previewId);
    drop.addEventListener('click', (e) => { if (e.target.tagName !== 'INPUT') file.click(); });
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      name.textContent = f.name;
      const reader = new FileReader();
      reader.onload = (ev) => {
        preview.style.backgroundImage = `url(${ev.target.result})`;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(f);
    });
    ['dragenter','dragover'].forEach(evt => {
      drop.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation();
        drop.classList.add('drag');
      });
    });
    ['dragleave','drop'].forEach(evt => {
      drop.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation();
        drop.classList.remove('drag');
      });
    });
    drop.addEventListener('drop', (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) {
        const dt = new DataTransfer();
        dt.items.add(f);
        file.files = dt.files;
        file.dispatchEvent(new Event('change'));
      }
    });
    return { drop, file, name, preview, reset() {
      file.value = '';
      name.textContent = '';
      preview.style.display = 'none';
      preview.style.backgroundImage = '';
    }};
  }

  // =====================================================================
  // PORTFOLIO
  // =====================================================================
  const pf = wireDrop('pfDrop', 'pfFile', 'pfFileName', 'pfPreview');

  async function loadPortfolio() {
    const list = $('pfList');
    list.innerHTML = '<div class="loading">Betöltés…</div>';
    const { data, error } = await sb
      .from('portfolio_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) {
      list.innerHTML = '<div class="list-empty">Hiba a betöltés során: ' + escapeHtml(error.message) + '</div>';
      return;
    }
    renderPortfolio(data || []);
  }

  function renderPortfolio(items) {
    const list = $('pfList');
    if (!items.length) {
      list.innerHTML = '<div class="list-empty">Még nincs projekt. Adjon hozzá egyet bal oldalt.</div>';
      return;
    }
    list.innerHTML = items.map((it, i) => `
      <div class="row" data-id="${it.id}">
        <div class="thumb" style="${it.image_url ? `background-image:url(${escapeHtml(it.image_url)})` : ''}"></div>
        <div class="meta">
          <p class="t">${escapeHtml(it.title)}</p>
          <p class="s">${escapeHtml(it.subtitle || '—')}</p>
        </div>
        <div class="actions">
          <button class="btn icon ghost" data-act="up"    ${i === 0 ? 'disabled' : ''} title="Feljebb">▲</button>
          <button class="btn icon ghost" data-act="down"  ${i === items.length - 1 ? 'disabled' : ''} title="Lejjebb">▼</button>
          <button class="btn sm danger"  data-act="del"   title="Törlés">Törlés</button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.row').forEach((row, i) => {
      row.querySelector('[data-act="up"]')?.addEventListener('click',   () => swapPortfolio(items, i, i - 1));
      row.querySelector('[data-act="down"]')?.addEventListener('click', () => swapPortfolio(items, i, i + 1));
      row.querySelector('[data-act="del"]')?.addEventListener('click',  () => deletePortfolio(items[i]));
    });
  }

  async function swapPortfolio(items, i, j) {
    if (j < 0 || j >= items.length) return;
    const a = items[i], b = items[j];
    // Use values 10-apart so we always have room
    const av = (a.sort_order ?? 0), bv = (b.sort_order ?? 0);
    await sb.from('portfolio_items').update({ sort_order: bv }).eq('id', a.id);
    await sb.from('portfolio_items').update({ sort_order: av }).eq('id', b.id);
    await loadPortfolio();
  }

  async function deletePortfolio(item) {
    if (!confirm(`Biztosan törölni szeretné: "${item.title}"?`)) return;
    if (item.image_url) {
      const p = deriveStoragePath(item.image_url, 'portfolio-images');
      if (p) await sb.storage.from('portfolio-images').remove([p]);
    }
    const { error } = await sb.from('portfolio_items').delete().eq('id', item.id);
    if (error) { alert('Hiba: ' + error.message); return; }
    loadPortfolio();
  }

  $('pfForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('pfErr'), okEl = $('pfOk');
    setMsg(errEl, ''); setMsg(okEl, '');
    const submit = $('pfSubmit');
    submit.disabled = true; submit.textContent = 'Mentés…';
    try {
      const title = $('pfTitle').value.trim();
      const subtitle = $('pfSub').value.trim() || null;
      const file = $('pfFile').files[0] || null;
      let image_url = null;
      if (file) {
        submit.textContent = 'Kép feltöltése…';
        const u = await uploadImage('portfolio-images', file);
        image_url = u.url;
      }
      // Next sort order
      const { data: last } = await sb
        .from('portfolio_items')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);
      const next = ((last && last[0] && last[0].sort_order) || 0) + 10;
      submit.textContent = 'Mentés…';
      const { error } = await sb.from('portfolio_items').insert({
        title, subtitle, image_url, sort_order: next
      });
      if (error) throw error;
      setMsg(okEl, 'Hozzáadva.');
      $('pfForm').reset(); pf.reset();
      loadPortfolio();
    } catch (ex) {
      setMsg(errEl, ex.message || 'Hiba történt.');
    } finally {
      submit.disabled = false; submit.textContent = 'Hozzáadás';
    }
  });

  // =====================================================================
  // MACHINES
  // =====================================================================
  const m = wireDrop('mDrop', 'mFile', 'mFileName', 'mPreview');

  async function loadMachines() {
    const list = $('mList');
    list.innerHTML = '<div class="loading">Betöltés…</div>';
    const { data, error } = await sb
      .from('machines')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) {
      list.innerHTML = '<div class="list-empty">Hiba a betöltés során: ' + escapeHtml(error.message) + '</div>';
      return;
    }
    renderMachines(data || []);
  }

  function renderMachines(items) {
    const list = $('mList');
    if (!items.length) {
      list.innerHTML = '<div class="list-empty">Még nincs gép. Adjon hozzá egyet bal oldalt.</div>';
      return;
    }
    list.innerHTML = items.map((it, i) => `
      <div class="row" data-id="${it.id}">
        <div class="thumb" style="${it.image_url ? `background-image:url(${escapeHtml(it.image_url)})` : ''}"></div>
        <div class="meta">
          <p class="t">${escapeHtml(it.name)}</p>
          <p class="s">${escapeHtml([it.tag, it.description].filter(Boolean).join(' · ') || '—')}</p>
        </div>
        <div class="actions">
          <button class="btn icon ghost" data-act="up"   ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn icon ghost" data-act="down" ${i === items.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="btn sm danger"  data-act="del">Törlés</button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.row').forEach((row, i) => {
      row.querySelector('[data-act="up"]')?.addEventListener('click',   () => swapMachines(items, i, i - 1));
      row.querySelector('[data-act="down"]')?.addEventListener('click', () => swapMachines(items, i, i + 1));
      row.querySelector('[data-act="del"]')?.addEventListener('click',  () => deleteMachine(items[i]));
    });
  }

  async function swapMachines(items, i, j) {
    if (j < 0 || j >= items.length) return;
    const a = items[i], b = items[j];
    const av = (a.sort_order ?? 0), bv = (b.sort_order ?? 0);
    await sb.from('machines').update({ sort_order: bv }).eq('id', a.id);
    await sb.from('machines').update({ sort_order: av }).eq('id', b.id);
    await loadMachines();
  }

  async function deleteMachine(item) {
    if (!confirm(`Biztosan törölni szeretné: "${item.name}"?`)) return;
    if (item.image_url) {
      const p = deriveStoragePath(item.image_url, 'machine-images');
      if (p) await sb.storage.from('machine-images').remove([p]);
    }
    const { error } = await sb.from('machines').delete().eq('id', item.id);
    if (error) { alert('Hiba: ' + error.message); return; }
    loadMachines();
  }

  $('mForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('mErr'), okEl = $('mOk');
    setMsg(errEl, ''); setMsg(okEl, '');
    const submit = $('mSubmit');
    submit.disabled = true; submit.textContent = 'Mentés…';
    try {
      const name = $('mName').value.trim();
      const tag  = $('mTag').value.trim() || null;
      const description = $('mDesc').value.trim() || null;
      const file = $('mFile').files[0] || null;
      let image_url = null;
      if (file) {
        submit.textContent = 'Kép feltöltése…';
        const u = await uploadImage('machine-images', file);
        image_url = u.url;
      }
      const { data: last } = await sb
        .from('machines')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);
      const next = ((last && last[0] && last[0].sort_order) || 0) + 10;
      submit.textContent = 'Mentés…';
      const { error } = await sb.from('machines').insert({
        name, tag, description, image_url, sort_order: next
      });
      if (error) throw error;
      setMsg(okEl, 'Hozzáadva.');
      $('mForm').reset(); m.reset();
      loadMachines();
    } catch (ex) {
      setMsg(errEl, ex.message || 'Hiba történt.');
    } finally {
      submit.disabled = false; submit.textContent = 'Hozzáadás';
    }
  });
})();
