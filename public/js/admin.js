let allProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('adminToken');

    if (token) {
        try {
            const r = await fetch('/api/admin/orders', { 
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            
            if (r.status === 401) {
                localStorage.removeItem('adminToken');
                showLoginScreen();
            } else {
                showAdmin();
            }
        } catch (e) {
            showLoginScreen(); 
        }
    } else {
        showLoginScreen();
    }
});

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function toast(msg, type='') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = 'toast', 3000);
}

async function api(path, opt = {}) {
    const currentToken = localStorage.getItem('adminToken');
    
    opt.headers = {
        ...opt.headers,
        'Authorization': currentToken ? `Bearer ${currentToken}` : '',
        'Content-Type': 'application/json'
    };

    const res = await fetch(path, opt);
    
    if (res.status === 401) {
        localStorage.removeItem('adminToken');
        location.reload(); 
    }
    
    return res.json();
}

async function doLogin() {
  const username = document.getElementById('u').value.trim();
  const password = document.getElementById('p').value;
  const errEl = document.getElementById('login-err');
  const btn   = document.getElementById('login-btn');

  if (!username || !password) { 
    errEl.textContent='Completează toate câmpurile.'; 
    errEl.style.display='block'; 
    return; 
  }

  btn.textContent='...'; 
  btn.disabled = true;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const d = await res.json();

    if (d.success) { 
      localStorage.setItem('adminToken', d.token); 
      token = d.token; 
      location.reload(); 
    } else { 
      errEl.textContent = d.error || 'Eroare.'; 
      errEl.style.display = 'block'; 
    }
  } catch { 
    errEl.textContent = 'Server indisponibil.'; 
    errEl.style.display = 'block'; 
  } finally {
    btn.textContent = 'Intră'; 
    btn.disabled = false;
  }
}

function doLogout() {
    localStorage.removeItem('adminToken');
    location.reload(); // Returns user to login screen
}

function showAdmin() {
  document.getElementById('login-screen').style.display='none';
  document.getElementById('admin-screen').classList.add('visible');
  loadDashboard(); loadProducts();
}

function showLoginScreen() {
  document.getElementById('admin-screen').classList.remove('visible');
  document.getElementById('admin-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex'; // Use 'block' if CSS prefers it
}

function navigate(page) {
  document.querySelectorAll('.nav-tab,.btab').forEach(t => t.classList.toggle('active', t.dataset.page===page));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id===`page-${page}`));
  if (page==='dashboard') loadDashboard();
  if (page==='orders')    loadOrders();
  if (page==='products')  loadProducts();
  if (page==='logs')      loadLogs();
}
document.querySelectorAll('.nav-tab,.btab').forEach(t => t.addEventListener('click', ()=>navigate(t.dataset.page)));

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ro-RO')+' '+d.toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'});
}
function catBadge(cat) {
  const c = cat||'General';
  return `<span class="badge b-${esc(c)}">${esc(c)}</span>`;
}
function renderOrderCard(o) {
  const items = (o.cart||[]).map(i=>`${esc(i.name)} ×${esc(i.qty)}`).join(', ');
  return `<div class="ocard">
    <div class="ocard-top"><div class="ocard-name">${esc(o.customer?.name||'—')}</div><div class="ocard-total">${esc(o.total)} MDL</div></div>
    <div class="ocard-meta">${esc(o.customer?.phone||'')}${o.customer?.address?' · '+esc(o.customer.address):''}<br>${items}<br>${fmtDate(o.timestamp)}</div>
    <div class="ocard-id">${esc(o.id)}</div>
  </div>`;
}

async function loadDashboard() {
  try {
    const [od,pd] = await Promise.all([api('/api/admin/orders'),api('/api/admin/products')]);
    const orders=od.orders||[], prods=pd.products||[];
    const rev=orders.reduce((s,o)=>s+(o.total||0),0);
    const avg=orders.length?Math.round(rev/orders.length):0;
    document.getElementById('s-orders').textContent=orders.length;
    document.getElementById('s-rev').textContent=rev.toLocaleString('ro-RO')+' MDL';
    document.getElementById('s-avg').textContent=avg+' MDL';
    document.getElementById('s-prod').textContent=prods.length;
    const recent=[...orders].reverse().slice(0,5);
    const empty=`<tr><td colspan="5" style="text-align:center;padding:26px;color:var(--sub);">Nicio comandă încă.</td></tr>`;
    document.getElementById('dash-tbody').innerHTML = recent.length===0 ? empty
      : recent.map(o=>`<tr>
          <td><span class="oid">${esc(o.id)}</span></td>
          <td>${esc(o.customer?.name||'—')}</td>
          <td>${esc(o.customer?.phone||'—')}</td>
          <td class="ototal">${esc(o.total)} MDL</td>
          <td>${fmtDate(o.timestamp)}</td>
        </tr>`).join('');
    const dc=document.getElementById('dash-cards');
    dc.innerHTML=recent.length===0?`<div class="empty">Nicio comandă încă.</div>`:recent.map(renderOrderCard).join('');
  } catch(e){console.error(e);}
}

async function loadOrders() {
  const tbody=document.getElementById('orders-tbody');
  const cards=document.getElementById('orders-cards');
  tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:26px;color:var(--sub);">Se încarcă...</td></tr>`;
  cards.innerHTML=`<div class="empty">Se încarcă...</div>`;
  try {
    const d=await api('/api/admin/orders');
    const orders=[...(d.orders||[])].reverse();
    if (!orders.length) {
      tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:26px;color:var(--sub);">Nicio comandă.</td></tr>`;
      cards.innerHTML=`<div class="empty">Nicio comandă.</div>`; return;
    }
    tbody.innerHTML=orders.map(o=>{
      const items=(o.cart||[]).map(i=>`${esc(i.name)} ×${esc(i.qty)}`).join(', ');
      return `<tr>
        <td><span class="oid">${esc(o.id)}</span></td>
        <td><strong>${esc(o.customer?.name||'—')}</strong><br><small style="color:var(--sub);">${esc(o.customer?.address||'')}</small></td>
        <td>${esc(o.customer?.phone||'—')}<br><small style="color:var(--sub);">${esc(o.customer?.email||'')}</small></td>
        <td><div class="oitems">${items}</div></td>
        <td class="ototal">${esc(o.total)} MDL</td>
        <td>${fmtDate(o.timestamp)}</td>
      </tr>`;
    }).join('');
    cards.innerHTML=orders.map(renderOrderCard).join('');
  } catch { tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:26px;color:var(--red);">Eroare.</td></tr>`; }
}

async function loadProducts() {
  try {
    const d=await api('/api/admin/products');
    allProducts=d.products||[]; renderProducts();
  } catch(e){console.error(e);}
}

function renderProducts() {
  const grid=document.getElementById('prod-grid');
  const list=document.getElementById('prod-list');
  if (!allProducts.length) {
    const html=`<div class="empty">Niciun produs. Adaugă primul!</div>`;
    grid.innerHTML=`<div style="grid-column:1/-1;">${html}</div>`; list.innerHTML=html; return;
  }
  grid.innerHTML=allProducts.map(p=>`
    <div class="flower-card ${p.listed===false?'unlisted':''}" onclick="openEdit(${Number(p.id)})">
      <img class="card-img" src="${esc(p.image||'')}" alt="${esc(p.name)}" onerror="this.src='https://placehold.co/400x200/f7f4f1/aa0132?text=+'">
      <div class="card-body">
        <div class="card-name">${esc(p.name)}</div>
        <div class="card-family">${esc(p.family||'')}</div>
        <div class="card-price">${esc(p.price)} MDL</div>
        <div>${catBadge(p.category)}</div>
      </div>
    </div>`).join('');
  list.innerHTML=allProducts.map(p=>`
    <div class="prod-row ${p.listed===false?'unlisted':''}" onclick="openEdit(${Number(p.id)})">
      <img class="prod-thumb" src="${esc(p.image||'')}" alt="${esc(p.name)}" onerror="this.src='https://placehold.co/100x100/f7f4f1/aa0132?text=+'">
      <div class="prod-row-info">
        <div class="prod-row-name">${esc(p.name)}</div>
        <div class="prod-row-meta">
          <span class="prod-row-price">${esc(p.price)} MDL</span>
          ${catBadge(p.category)}
          ${p.listed===false?`<span class="prod-row-dim">Nelistat</span>`:''}
        </div>
      </div>
      <span class="prod-chevron">›</span>
    </div>`).join('');
}

// Image upload — add form
let uploadedFile=null;
const dropZone=document.getElementById('drop-zone');
const fileInput=document.getElementById('f-img-file');
const preview=document.getElementById('drop-preview');
function handleFile(file) {
  if (!file||!file.type.startsWith('image/')) { toast('Doar imagini acceptate.','error'); return; }
  if (file.size>5*1024*1024) { toast('Max 5MB.','error'); return; }
  uploadedFile=file;
  const r=new FileReader(); r.onload=e=>{preview.src=e.target.result;preview.classList.add('visible');}; r.readAsDataURL(file);
}
dropZone.addEventListener('dragover', e=>{e.preventDefault();dropZone.classList.add('drag-over');});
dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop',e=>{e.preventDefault();dropZone.classList.remove('drag-over');handleFile(e.dataTransfer.files[0]);});
fileInput.addEventListener('change',()=>handleFile(fileInput.files[0]));

document.getElementById('add-btn').addEventListener('click', async ()=>{
  const name=document.getElementById('f-name').value.trim();
  const price=document.getElementById('f-price').value.trim();
  if (!name||!price) { toast('Nume și preț sunt obligatorii.','error'); return; }
  const btn=document.getElementById('add-btn');
  btn.textContent='Se adaugă...'; btn.disabled=true;
  try {
    let imagePath='';
    if (uploadedFile) {
      const fd=new FormData(); fd.append('image',uploadedFile);
      const up=await fetch('/api/admin/upload',{method:'POST',headers:{'Authorization': `Bearer ${localStorage.getItem('adminToken')}`},body:fd}).then(r=>r.json());
      if (up.success){imagePath=up.path;}else{toast('Eroare upload: '+up.error,'error');btn.textContent='Adaugă în catalog';btn.disabled=false;return;}
    }
    const d=await api('/api/admin/products',{method:'POST',body:JSON.stringify({
      name,price,category:document.getElementById('f-cat').value,
      family:document.getElementById('f-family').value.trim(),
      desc:document.getElementById('f-desc').value.trim(),
      care:document.getElementById('f-care').value.trim(),
      note:document.getElementById('f-note').value.trim(),
      image:imagePath
    })});
    if (d.success) {
      toast('Produs adăugat!','success');
      ['f-name','f-price','f-family','f-desc','f-care','f-note'].forEach(id=>document.getElementById(id).value='');
      preview.classList.remove('visible'); uploadedFile=null; fileInput.value='';
      loadProducts();
    } else toast(d.error,'error');
  } catch { toast('Eroare la adăugare.','error'); }
  btn.textContent='Adaugă în catalog'; btn.disabled=false;
});

// Edit modal
let editFile=null;
const eDropZone=document.getElementById('e-drop-zone');
const eFileInput=document.getElementById('e-img-file');
const eThumb=document.getElementById('e-img-thumb');
function handleEditFile(file) {
  if (!file||!file.type.startsWith('image/')) { toast('Doar imagini acceptate.','error'); return; }
  if (file.size>5*1024*1024) { toast('Max 5MB.','error'); return; }
  editFile=file;
  const r=new FileReader(); r.onload=e=>{eThumb.src=e.target.result;eThumb.style.display='block';}; r.readAsDataURL(file);
}
eDropZone.addEventListener('dragover', e=>{e.preventDefault();eDropZone.classList.add('drag-over');});
eDropZone.addEventListener('dragleave',()=>eDropZone.classList.remove('drag-over'));
eDropZone.addEventListener('drop',e=>{e.preventDefault();eDropZone.classList.remove('drag-over');handleEditFile(e.dataTransfer.files[0]);});
eFileInput.addEventListener('change',()=>handleEditFile(eFileInput.files[0]));

function openEdit(id) {
  const p=allProducts.find(x=>x.id===id); if (!p) return;
  document.getElementById('e-id').value=p.id;
  document.getElementById('e-name').value=p.name;
  document.getElementById('e-price').value=p.price;
  document.getElementById('e-cat').value=p.category||'General';
  document.getElementById('e-family').value=p.family||'';
  document.getElementById('e-desc').value=p.desc||'';
  document.getElementById('e-care').value=p.care||'';
  document.getElementById('e-note').value=p.note||'';
  document.getElementById('e-toggle-list').textContent=p.listed===false?'Listează':'Delistează';
  if (p.image){eThumb.src=p.image;eThumb.style.display='block';}else{eThumb.style.display='none';}
  editFile=null; eFileInput.value='';
  document.getElementById('edit-overlay').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeEdit() {
  document.getElementById('edit-overlay').classList.remove('open');
  document.body.style.overflow='';
}
document.getElementById('modal-close').addEventListener('click',closeEdit);
document.getElementById('edit-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('edit-overlay'))closeEdit();});

document.getElementById('e-save').addEventListener('click', async ()=>{
  const id=Number(document.getElementById('e-id').value);
  const btn=document.getElementById('e-save');
  btn.textContent='Se salvează...'; btn.disabled=true;
  try {
    let imagePath;
    if (editFile) {
      const fd=new FormData(); fd.append('image',editFile);
      const up=await fetch('/api/admin/upload',{method:'POST',headers:{'Authorization': `Bearer ${localStorage.getItem('adminToken')}`},body:fd}).then(r=>r.json());
      if (up.success){imagePath=up.path;}else{toast('Eroare upload: '+up.error,'error');btn.textContent='Salvează';btn.disabled=false;return;}
    }
    const payload={
      name:document.getElementById('e-name').value.trim(),
      price:document.getElementById('e-price').value,
      category:document.getElementById('e-cat').value,
      family:document.getElementById('e-family').value.trim(),
      desc:document.getElementById('e-desc').value.trim(),
      care:document.getElementById('e-care').value.trim(),
      note:document.getElementById('e-note').value.trim(),
    };
    if (imagePath) payload.image=imagePath;
    if (!payload.name||!payload.price){toast('Nume și preț obligatorii.','error');btn.textContent='Salvează';btn.disabled=false;return;}
    const d=await api(`/api/admin/products/${id}`,{method:'PATCH',body:JSON.stringify(payload)});
    if (d.success){toast('Salvat!','success');closeEdit();loadProducts();}
    else toast(d.error,'error');
  } catch { toast('Eroare la salvare.','error'); }
  btn.textContent='Salvează'; btn.disabled=false;
});

document.getElementById('e-toggle-list').addEventListener('click', async ()=>{
  const id=Number(document.getElementById('e-id').value);
  try {
    const d=await api(`/api/admin/products/${id}/toggle`,{method:'PATCH'});
    if (d.success){toast(d.listed?'Listat.':'Delistat.','success');closeEdit();loadProducts();}
    else toast(d.error,'error');
  } catch { toast('Eroare.','error'); }
});

document.getElementById('e-delete').addEventListener('click', async ()=>{
  if (!confirm('Sigur vrei să ștergi acest produs?')) return;
  const id=Number(document.getElementById('e-id').value);
  try {
    const d=await api(`/api/admin/products/${id}`,{method:'DELETE'});
    if (d.success){toast('Produs șters.','success');closeEdit();loadProducts();}
    else toast(d.error,'error');
  } catch { toast('Eroare la ștergere.','error'); }
});

async function loadLogs() {
  const box=document.getElementById('logs-box');
  box.textContent='Se încarcă...';
  try {
    const d=await api('/api/admin/logs');
    const logs=d.logs||[];
    if (!logs.length){box.textContent='Nu există loguri.';return;}
    box.innerHTML=logs.map(l=>{
      const lvl=l.match(/\[(INFO|WARN|ERROR)\]/)?.[1]||'';
      return `<div class="log-${esc(lvl)}">${esc(l)}</div>`;
    }).join('');
  } catch { box.textContent='Eroare la încărcare.'; }
}

document.getElementById('dash-ref').addEventListener('click',  loadDashboard);
document.getElementById('orders-ref').addEventListener('click',loadOrders);
document.getElementById('prod-ref').addEventListener('click',  loadProducts);
document.getElementById('logs-ref').addEventListener('click',  loadLogs);
document.getElementById('logout-btn').addEventListener('click',doLogout);
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('p').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});

