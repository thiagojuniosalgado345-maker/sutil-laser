(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const config = window.SUPABASE_CONFIG || {};
  const configured = typeof config.url === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url)
    && typeof config.anonKey === 'string' && config.anonKey.length > 20 && !config.anonKey.startsWith('COLE_');
  const client = configured && window.supabase?.createClient ? window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : null;
  let currentUser = null;
  let products = [];
  let settings = null;
  const money = value => value === null || value === undefined || value === '' ? 'Consulte o valor' : Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  function status(id,message,error=false){const el=$(id);el.textContent=message;el.classList.toggle('error',error)}
  function busy(button,busy,label){button.disabled=busy;if(label)button.textContent=label}
  function showLogin(message=''){ $('loginPanel').hidden=false;$('adminApp').hidden=true;$('logoutButton').hidden=true;if(message)status('loginStatus',message,true); }
  function showApp(){ $('loginPanel').hidden=true;$('adminApp').hidden=false;$('logoutButton').hidden=false;$('signedInAs').textContent='Conectado como '+(currentUser?.email || 'administrador');}
  function slugify(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65)||'produto'}
  function switchTab(id){
    document.querySelectorAll('.tab').forEach(tab=>{const active=tab.dataset.tab===id;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active))});
    ['productsTab','storeTab'].forEach(tabId=>$(tabId).hidden=tabId!==id);
    $('productEditor').hidden=true;
  }
  async function verifyAdmin(user){
    const {data,error}=await client.from('user_roles').select('role').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(data?.role!=='admin')throw new Error('Esta conta não tem permissão de administrador. Peça ao responsável para conceder acesso.');
    currentUser=user;
    showApp();
    await Promise.all([loadProducts(),loadSettings()]);
  }
  async function loadProducts(){
    const {data,error}=await client.from('products').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:false});
    if(error)throw error;
    products=data||[];
    renderProducts();
  }
  function renderProducts(){
    $('activeCount').textContent=products.filter(p=>p.active).length;
    $('totalCount').textContent=products.length;
    $('featuredCount').textContent=products.filter(p=>p.featured).length;
    if(!products.length){$('productList').innerHTML='<div class="empty-state">Nenhum produto cadastrado. Use “Novo produto” para começar.</div>';return}
    $('productList').innerHTML=products.map(p=>{
      const image=p.image_url?'<img class="product-thumb" src="'+esc(p.image_url)+'" alt="" loading="lazy">':'<div class="thumb-placeholder">SL</div>';
      const price=p.price_label || money(p.price);
      const state=p.active?'Publicado':'Oculto';
      return '<article class="product-row">'+image+'<div><h3>'+esc(p.name)+'</h3><small>'+esc(p.category)+' · '+esc(price)+' · '+state+(p.featured?' · Destaque':'')+'</small></div><div class="row-actions"><button class="btn btn-light" type="button" data-edit="'+esc(p.id)+'">Editar</button><button class="btn btn-light" type="button" data-toggle="'+esc(p.id)+'">'+(p.active?'Ocultar':'Publicar')+'</button><button class="btn btn-danger" type="button" data-delete="'+esc(p.id)+'">Excluir</button></div></article>';
    }).join('');
  }
  function clearEditor(){
    $('productForm').reset();$('productId').value='';$('productOrder').value=products.length*10;
    $('productActive').value='true';$('productFeatured').value='false';
    ['optionText','optionLogo','optionFont','optionColor','optionPosition','optionSize'].forEach(id=>$(id).checked=true);
    $('currentImage').textContent='Nenhuma foto cadastrada';
    $('formTitle').textContent='Novo produto';$('productStatus').textContent='';
  }
  function openEditor(product=null){
    clearEditor();
    if(product){
      $('formTitle').textContent='Editar produto';
      $('productId').value=product.id;
      $('productName').value=product.name||'';
      $('productCategory').value=product.category||'';
      $('productPrice').value=product.price??'';
      $('productPriceLabel').value=product.price_label||'';
      $('productDescription').value=product.description||product.short_description||'';
      $('productImageUrl').value=product.image_url||'';
      $('productOrder').value=product.sort_order??0;
      $('productActive').value=String(!!product.active);
      $('productFeatured').value=String(!!product.featured);
      const options=product.personalization||{};
      $('optionText').checked=options.text!==false;
      $('optionLogo').checked=options.logo!==false;
      $('optionFont').checked=options.font!==false;
      $('optionColor').checked=options.color!==false;
      $('optionPosition').checked=options.position!==false;
      $('optionSize').checked=options.size!==false;
      if(product.image_url){$('currentImage').innerHTML='<img src="'+esc(product.image_url)+'" alt="Foto atual">';}
    }
    $('productEditor').hidden=false;
    $('productEditor').scrollIntoView({behavior:'smooth',block:'start'});
    $('productName').focus();
  }
  async function uploadPhoto(file){
    if(!file)return null;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>10*1024*1024)
      throw new Error('Envie uma foto JPG, PNG ou WEBP de até 10 MB.');
    const extension=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
    const path='products/'+crypto.randomUUID()+'.'+extension;
    const {error}=await client.storage.from('product-images').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
    if(error)throw error;
    const {data}=client.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  }
  async function saveProduct(event){
    event.preventDefault();
    const button=$('saveProductButton');
    busy(button,true,'Salvando…');
    try{
      const id=$('productId').value;
      const existing=products.find(p=>p.id===id);
      let imageUrl=$('productImageUrl').value.trim();
      if(imageUrl && !/^https:\/\//i.test(imageUrl))throw new Error('A URL da foto deve começar com https://.');
      const file=$('productPhoto').files?.[0];
      if(file)imageUrl=await uploadPhoto(file);
      const rawPrice=$('productPrice').value.trim();
      const price=rawPrice===''?null:Number(rawPrice);
      if(price!==null && (!Number.isFinite(price)||price<0))throw new Error('Informe um preço válido ou deixe o campo vazio.');
      const product={
        slug:slugify($('productName').value)+'-'+(id ? id.slice(0,8) : crypto.randomUUID().slice(0,8)),
        name:$('productName').value.trim(),
        category:$('productCategory').value.trim(),
        short_description:$('productDescription').value.trim(),
        description:$('productDescription').value.trim(),
        price,
        price_label:$('productPriceLabel').value.trim() || (price===null?'Consulte o valor':money(price)),
        image_url:imageUrl||null,
        model_type:existing?.model_type||'other',
        personalization:{
          text:$('optionText').checked,logo:$('optionLogo').checked,font:$('optionFont').checked,
          color:$('optionColor').checked,position:$('optionPosition').checked,size:$('optionSize').checked
        },
        active:$('productActive').value==='true',
        featured:$('productFeatured').value==='true',
        sort_order:Number.parseInt($('productOrder').value,10)||0
      };
      const result=id
        ? await client.from('products').update(product).eq('id',id).select().single()
        : await client.from('products').insert(product).select().single();
      if(result.error)throw result.error;
      await loadProducts();
      $('productEditor').hidden=true;
      $('productPhoto').value='';
      status('productStatus','Produto salvo e publicado no catálogo.');
    }catch(error){status('productStatus',error.message||'Não foi possível salvar o produto.',true)}
    finally{busy(button,false,'Salvar produto')}
  }
  async function loadSettings(){
    const {data,error}=await client.from('store_settings').select('*').eq('id',1).maybeSingle();
    if(error)throw error;
    settings=data||{};
    $('storeName').value=settings.store_name||'Sútil Laser';
    $('storeTagline').value=settings.tagline||'';
    $('storeInstagram').value=settings.instagram_url||'';
    $('storeWhatsapp').value=settings.whatsapp_number||'';
    $('storeEmail').value=settings.contact_email||'';
  }
  async function saveSettings(event){
    event.preventDefault();
    const button=$('saveStoreButton');busy(button,true,'Salvando…');
    try{
      const instagram=$('storeInstagram').value.trim();
      if(instagram && !/^https:\/\//i.test(instagram))throw new Error('Use o endereço completo https:// para o Instagram.');
      const values={
        id:1,
        store_name:$('storeName').value.trim(),
        tagline:$('storeTagline').value.trim(),
        instagram_url:instagram||null,
        whatsapp_number:$('storeWhatsapp').value.replace(/\D/g,'')||null,
        contact_email:$('storeEmail').value.trim()||null
      };
      const {error}=await client.from('store_settings').update(values).eq('id',1);
      if(error)throw error;
      status('storeStatus','Dados da loja atualizados.');
    }catch(error){status('storeStatus',error.message||'Não foi possível salvar os dados.',true)}
    finally{busy(button,false,'Salvar dados da loja')}
  }
  async function handleProductList(event){
    const edit=event.target.closest('[data-edit]');
    const toggle=event.target.closest('[data-toggle]');
    const del=event.target.closest('[data-delete]');
    if(edit){const product=products.find(p=>p.id===edit.dataset.edit);if(product)openEditor(product);return}
    if(toggle){
      const product=products.find(p=>p.id===toggle.dataset.toggle);if(!product)return;
      toggle.disabled=true;
      const {error}=await client.from('products').update({active:!product.active}).eq('id',product.id);
      if(error){alert('Não foi possível alterar o status: '+error.message);toggle.disabled=false;return}
      await loadProducts();return;
    }
    if(del){
      const product=products.find(p=>p.id===del.dataset.delete);if(!product)return;
      if(!confirm('Excluir “'+product.name+'” do catálogo? Esta ação não pode ser desfeita.'))return;
      del.disabled=true;
      const {error}=await client.from('products').delete().eq('id',product.id);
      if(error){alert('Não foi possível excluir: '+error.message);del.disabled=false;return}
      await loadProducts();
    }
  }
  async function signOut(){
    if(client)await client.auth.signOut();
    currentUser=null;products=[];showLogin();
  }
  async function boot(){
    if(!client){
      $('setupAlert').hidden=false;
      $('loginButton').disabled=true;
      status('loginStatus','Configure primeiro o Supabase no arquivo config.js.',true);
      return;
    }
    $('loginForm').addEventListener('submit',async event=>{
      event.preventDefault();const button=$('loginButton');busy(button,true,'Verificando…');
      try{
        const {data,error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
        if(error)throw error;
        await verifyAdmin(data.user);
        status('loginStatus','');
      }catch(error){
        await client.auth.signOut();
        showLogin(error.message||'Não foi possível entrar.');
      }finally{busy(button,false,'Entrar no painel')}
    });
    $('logoutButton').addEventListener('click',signOut);
    $('addProductButton').addEventListener('click',()=>openEditor());
    $('cancelEditButton').addEventListener('click',()=>$('productEditor').hidden=true);
    $('cancelEditButtonBottom').addEventListener('click',()=>$('productEditor').hidden=true);
    $('productForm').addEventListener('submit',saveProduct);
    $('storeForm').addEventListener('submit',saveSettings);
    $('productList').addEventListener('click',handleProductList);
    document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>switchTab(tab.dataset.tab)));
    client.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'){currentUser=null;showLogin()}
    });
    const {data,error}=await client.auth.getSession();
    if(error){showLogin(error.message);return}
    if(data.session){
      try{await verifyAdmin(data.session.user)}catch(error){await client.auth.signOut();showLogin(error.message)}
    }
  }
  boot();
})();