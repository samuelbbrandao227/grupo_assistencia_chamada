const form = document.getElementById('login-form');
const errorMsg = document.getElementById('error-msg');
const submitBtn = document.getElementById('submit-btn');

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  errorMsg.classList.remove('show');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Entrando…';

  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;
  const grupo = form.querySelector('input[name=grupo]:checked').value;

  try{
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha, grupo })
    });
    const data = await resp.json();

    if(!resp.ok || !data.success){
      throw new Error(data.error || 'Não foi possível entrar.');
    }

    sessionStorage.setItem('chamada_membros', JSON.stringify(data.membros));
    sessionStorage.setItem('chamada_grupo', data.grupo);
    window.location.href = '/chamada';

  } catch(err){
    errorMsg.textContent = err.message || 'Erro ao conectar com o servidor.';
    errorMsg.classList.add('show');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Entrar';
  }
});