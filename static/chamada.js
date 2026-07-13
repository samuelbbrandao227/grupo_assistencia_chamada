const listEl = document.getElementById('list');
const stateMsgEl = document.getElementById('state-msg');
const state = {};

// ===== Carrega os membros retornados pelo login =====
let MEMBROS = [];
try{
  MEMBROS = JSON.parse(sessionStorage.getItem('chamada_membros') || '[]');
}catch(e){
  MEMBROS = [];
}
const grupo = sessionStorage.getItem('chamada_grupo');
if(grupo){
  document.getElementById('grupo-badge').textContent = 'Grupo ' + grupo;
}

if(!MEMBROS || MEMBROS.length === 0){
  document.querySelector('.toolbar').style.display = 'none';
  document.querySelector('footer').style.display = 'none';
  stateMsgEl.style.display = 'block';
  stateMsgEl.innerHTML = 'Nenhum membro carregado. <a href="/">Faça login novamente</a> para buscar a lista do seu grupo.';
} else {
  buildList(MEMBROS);
}

function titleCase(str){
  const small = new Set(['da','de','do','das','dos','e']);
  return String(str).toLowerCase().split(' ').filter(Boolean).map((w,i)=>{
    if(small.has(w) && i!==0) return w;
    return w.charAt(0).toUpperCase()+w.slice(1);
  }).join(' ');
}

function buildList(membros){
  membros.forEach((membro, i)=>{
    const nome = typeof membro === 'string' ? membro : membro.nome;
    const id = 'p'+i;
    state[id] = { present:true, reason:null, group:'' };

    const row = document.createElement('div');
    row.className = 'row is-present';
    row.dataset.id = id;
    row.dataset.name = String(nome).toLowerCase();

    row.innerHTML = `
      <div class="idx">${String(i+1).padStart(2,'0')}</div>
      <div class="name">${titleCase(nome)}</div>
      <div class="toggle-cell">
        <span class="status-label">Presente</span>
        <label class="stamp-toggle">
          <input type="checkbox" checked data-role="presence">
          <span class="stamp">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
        </label>
      </div>
      <div class="reason-panel">
        <p class="reason-title">Motivo da ausência</p>
        <div class="options">
          <label class="opt">
            <input type="radio" name="reason-${id}" value="nao-pode-vir">
            Não pode vir
          </label>
          <label class="opt">
            <input type="radio" name="reason-${id}" value="assistencia">
            Precisa de assistência
          </label>
          <label class="opt">
            <input type="radio" name="reason-${id}" value="outro-grupo">
            Pertence a outro grupo
          </label>
          <div class="group-input">
            <input type="text" placeholder="Qual grupo?" data-role="group-name">
          </div>
          <label class="opt">
            <input type="radio" name="reason-${id}" value="nao-esta-mais">
            Não está mais na igreja
          </label>
        </div>
      </div>
    `;
    listEl.appendChild(row);
  });
  updateStats();
}

// events
listEl.addEventListener('change', (e)=>{
  const row = e.target.closest('.row');
  if(!row) return;
  const id = row.dataset.id;

  if(e.target.dataset.role === 'presence'){
    const present = e.target.checked;
    state[id].present = present;
    row.classList.toggle('is-present', present);
    row.classList.toggle('is-absent', !present);
    row.querySelector('.status-label').textContent = present ? 'Presente' : 'Ausente';
    if(present){
      state[id].reason = null;
      state[id].group = '';
      row.querySelectorAll('input[type=radio]').forEach(r=>r.checked=false);
      row.querySelector('.group-input').classList.remove('show');
      row.querySelector('[data-role=group-name]').value='';
    }
    updateStats();
  }

  if(e.target.name && e.target.name.startsWith('reason-')){
    state[id].reason = e.target.value;
    const groupInput = row.querySelector('.group-input');
    groupInput.classList.toggle('show', e.target.value === 'outro-grupo');
  }

  if(e.target.dataset.role === 'group-name'){
    state[id].group = e.target.value;
  }
});

function updateStats(){
  const ids = Object.keys(state);
  const present = ids.filter(id=>state[id].present).length;
  document.getElementById('count-present').textContent = present;
  document.getElementById('count-absent').textContent = ids.length - present;
  document.getElementById('count-total').textContent = ids.length;
}

// search
const searchInput = document.getElementById('search-input');
searchInput.addEventListener('input', ()=>{
  const q = searchInput.value.trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll('.row').forEach(row=>{
    const match = row.dataset.name.includes(q);
    row.style.display = match ? '' : 'none';
    if(match) visible++;
  });
  document.getElementById('empty-msg').style.display = visible === 0 ? 'block' : 'none';
});

// mark all present
document.getElementById('mark-all-present').addEventListener('click', ()=>{
  document.querySelectorAll('input[data-role=presence]').forEach(cb=>{
    if(!cb.checked){ cb.checked = true; cb.dispatchEvent(new Event('change', {bubbles:true})); }
  });
  showToast('Todos marcados como presentes');
});

// reset
document.getElementById('reset-all').addEventListener('click', ()=>{
  if(!confirm('Reiniciar a chamada? Todos os registros serão apagados.')) return;
  document.querySelectorAll('input[data-role=presence]').forEach(cb=>{
    if(!cb.checked){ cb.checked = true; cb.dispatchEvent(new Event('change', {bubbles:true})); }
  });
  document.getElementById('responsavel').value = '';
  document.getElementById('data-chamada').value = '';
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));
  showToast('Chamada reiniciada');
});

// logout
document.getElementById('logout').addEventListener('click', ()=>{
  sessionStorage.removeItem('chamada_membros');
  sessionStorage.removeItem('chamada_grupo');
  window.location.href = '/';
});

// print
document.getElementById('btn-print').addEventListener('click', ()=> window.print());

// copy summary
document.getElementById('btn-copy').addEventListener('click', ()=>{
  const data = document.getElementById('data-chamada').value;
  const resp = document.getElementById('responsavel').value.trim();
  const reasonLabels = {
    'assistencia': 'Precisa de assistência',
    'outro-grupo': 'Pertence a outro grupo',
    'nao-esta-mais': 'Não está mais na igreja'
  };

  let lines = [];
  lines.push('LISTA DE CHAMADA' + (grupo ? ' — Grupo ' + grupo : ''));
  if(data) lines.push('Data: ' + data);
  if(resp) lines.push('Responsável: ' + resp);
  lines.push('');

  const present = [];
  const absent = [];
  MEMBROS.forEach((membro, i)=>{
    const id = 'p'+i;
    const nomeOriginal = typeof membro === 'string' ? membro : membro.nome;
    const nome = titleCase(nomeOriginal);
    if(state[id].present){
      present.push(nome);
    } else {
      let reasonText = state[id].reason ? reasonLabels[state[id].reason] : 'Motivo não informado';
      if(state[id].reason === 'outro-grupo' && state[id].group){
        reasonText += ' (' + state[id].group + ')';
      }
      absent.push(`${nome} — ${reasonText}`);
    }
  });

  lines.push(`PRESENTES (${present.length})`);
  present.forEach(n=>lines.push('  • ' + n));
  lines.push('');
  lines.push(`AUSENTES (${absent.length})`);
  absent.forEach(n=>lines.push('  • ' + n));

  const text = lines.join('\n');
  navigator.clipboard.writeText(text).then(()=>{
    showToast('Resumo copiado para a área de transferência');
  }).catch(()=>{
    showToast('Não foi possível copiar automaticamente');
  });
});

let toastTimer;
function showToast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.remove('show'), 2600);
}

// default date = today
document.getElementById('data-chamada').valueAsDate = new Date();
