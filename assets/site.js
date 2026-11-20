(() => {
  'use strict';
  const $ = (selector, root=document) => root.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = value => value === null || value === undefined || value === '' || Number(value) <= 0
    ? 'Consulte o valor'
    : Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const config = window.SUPABASE_CONFIG || {};
  const configured = typeof config.url === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url)
    && typeof config.anonKey === 'string' && config.anonKey.length > 20 && !config.anonKey.startsWith('COLE_');
  const client = configured && window.supabase?.createClient ? window.supabase.createClient(config.url, config.anonKey) : null;
  let products = [];
  let settings = {store_name:'Sútil Laser',brand_mark:'S·L',brand_logo_url:'',accent_color:'#a98656',tagline:'Personalizados com significado',instagram_url:'https://www.instagram.com/sutillaser/',whatsapp_number:'',contact_email:''};
  let activeCategory = 'Todos';
  let selectedProduct = null;
  let quoteItems = [];
  let logoObjectUrl = null;

  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => el.classList.remove('show'), 3300);
  }
  function validExternalUrl(value, fallback='') {
    if (typeof value !== 'string' || !value.trim()) return fallback;
    try {
      const u = new URL(value, location.href);
      return ['https:'].includes(u.protocol) ? u.href : fallback;
    } catch { return fallback; }
  }
  function displaySettings() {
    const name = settings.store_name || 'Sútil Laser';
    document.title = name + ' | Personalizados com significado';
    document.querySelectorAll('.brand-name').forEach(el => { el.textContent = name.toLocaleUpperCase('pt-BR'); });
    $('#footerStore').textContent = name;
    document.querySelectorAll('.brand-mark').forEach(mark => {
      const logo = validExternalUrl(settings.brand_logo_url, '');
      if (logo) mark.innerHTML = '<img src="'+escapeHtml(logo)+'" alt="'+escapeHtml(name)+'">';
      else mark.textContent = settings.brand_mark || 'S·L';
    });
    if (/^#[0-9a-f]{6}$/i.test(settings.accent_color || '')) document.documentElement.style.setProperty('--gold', settings.accent_color);
    $('#heroDescription').textContent = settings.tagline || 'Personalizamos peças e presentes com gravação a laser, transformando ideias em lembranças com significado.';
    const insta = validExternalUrl(settings.instagram_url, 'https://www.instagram.com/');
    $('#footerInstagram').href = insta;
    $('#contactLink').href = insta;
    if (settings.whatsapp_number && String(settings.whatsapp_number).replace(/\D/g,'').length >= 10) {
      $('#contactLink').href = 'https://wa.me/' + String(settings.whatsapp_number).replace(/\D/g,'');
      $('#contactLink').textContent = 'Falar pelo WhatsApp ↗';
    }
  }
  function localProducts(list) {
    return list.map(p => ({
      id:p.id, name:p.name, category:p.category, description:p.description || p.short_description || '',
      price:p.price, price_label:p.price_label, image_url:p.image_url || p.image || '',
      gallery:p.gallery || [], model_type:p.model_type || p.model || 'other',
      personalization:p.personalization || {text:true,logo:true,font:true,color:true,position:true,size:true},
      featured:!!p.featured, active:p.active !== false, sort_order:p.sort_order || 0
    }));
  }
  async function loadData() {
    if (client) {
      try {
        const [productsResult, settingsResult] = await Promise.all([
          client.from('products').select('*').eq('active',true).order('sort_order',{ascending:true}).order('created_at',{ascending:false}),
          client.from('store_settings').select('*').eq('id',1).maybeSingle()
        ]);
        if (productsResult.error) throw productsResult.error;
        products = productsResult.data || [];
        if (settingsResult.data) settings = {...settings,...settingsResult.data};
        displaySettings();
        renderProducts();
        renderHeroImage();
        return;
      } catch (error) {
        console.error('Falha ao carregar o catálogo do Supabase:', error);
        toast('Não foi possível atualizar a coleção. Exibindo os dados de demonstração.');
      }
    }
    try {
      const response = await fetch('data/catalog.json',{cache:'no-store'});
      if (!response.ok) throw new Error('Catálogo local indisponível');
      const local = await response.json();
      products = localProducts(local).filter(product => product.active);
    } catch (error) {
      console.error(error);
      products = [];
    }
    displaySettings();
    renderProducts();
    renderHeroImage();
  }
  function renderHeroImage() {
    const featured = products.find(p => p.featured && p.image_url) || products.find(p => p.image_url);
    if (featured) {
      $('#heroProduct').innerHTML = '<img src="' + escapeHtml(featured.image_url) + '" alt="' + escapeHtml(featured.name) + '" loading="eager" onerror="this.remove()">';
    }
  }
  function categories() {
    return ['Todos',...new Set(products.map(p => p.category).filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR')))];
  }
  function renderFilters() {
    $('#filters').innerHTML = categories().map(category =>
      '<button type="button" class="filter '+(category===activeCategory?'active':'')+'" data-category="'+escapeHtml(category)+'" aria-pressed="'+(category===activeCategory)+'">'+escapeHtml(category)+'</button>'
    ).join('');
  }
  function photoMarkup(product) {
    const image = product.image_url || (Array.isArray(product.gallery) && product.gallery[0]) || '';
    if (image) return '<img loading="lazy" src="'+escapeHtml(image)+'" alt="'+escapeHtml(product.name)+'" onerror="this.parentElement.innerHTML=\'<div class=&quot;photo-empty&quot;><div><span>SL</span><small>foto em atualização</small></div></div>\'">';
    return '<div class="photo-empty"><div><span>SL</span><small>imagem em atualização</small></div></div>';
  }
  function filteredProducts() {
    const query = $('#search').value.trim().toLocaleLowerCase('pt-BR');
    return products.filter(p => (activeCategory==='Todos' || p.category===activeCategory)
      && (!query || [p.name,p.category,p.description].join(' ').toLocaleLowerCase('pt-BR').includes(query)));
  }
  function renderProducts() {
    renderFilters();
    const list = filteredProducts();
    $('#catalogCount').textContent = list.length + (list.length===1?' peça encontrada':' peças encontradas');
    $('#products').innerHTML = list.length ? list.map(p => `
      <article class="product-card">
        <div class="product-photo">${photoMarkup(p)}${p.featured?'<span class="featured-tag">Escolha especial</span>':''}</div>
        <div class="product-info">
          <span class="product-category">${escapeHtml(p.category || 'Coleção')}</span>
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description || 'Peça disponível para personalização sob consulta.')}</p>
          <div class="product-foot"><span class="product-price">${escapeHtml(p.price_label || money(p.price))}</span>
            <button class="product-open" type="button" data-product="${escapeHtml(p.id)}">Conhecer peça ↗</button>
          </div>
        </div>
      </article>`).join('') : '<div class="catalog-empty">Não encontramos peças com esse filtro. Experimente outra busca ou fale com a equipe.</div>';
  }
  function fieldVisible(field, key, defaults=true) {
    const enabled = selectedProduct?.personalization?.[key] ?? defaults;
    const element = $('#' + field);
    if (element) element.hidden = !enabled;
  }
  function openCustomizer(product) {
    selectedProduct = product;
    $('#modalTitle').textContent = product.name;
    $('#customText').value = '';
    $('#customLogo').value = '';
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    logoObjectUrl = null;
    $('#logoPreview').hidden = true;
    $('#textPreview').textContent = 'Seu nome';
    $('#textPreview').style.fontFamily = 'var(--serif)';
    $('#textPreview').style.fontSize = '23px';
    $('#textPreview').style.color = '#a98656';
    $('#customFont').value = 'serif';
    $('#customColor').value = '#a98656';
    $('#customSize').value = '23';
    $('#customPosition').value = '52';
    $('#customPositionX').value = '50';
    $('#customQuantity').value = '1';
    const image = product.image_url || (Array.isArray(product.gallery) && product.gallery[0]) || '';
    const previewImage = $('#previewImage');
    previewImage.onload = () => { previewImage.hidden = false; $('#stagePlaceholder').hidden = true; };
    previewImage.onerror = () => { previewImage.hidden = true; $('#stagePlaceholder').hidden = false; };
    previewImage.hidden = !image;
    if (image) previewImage.src = image; else previewImage.removeAttribute('src');
    $('#stagePlaceholder').hidden = !!image;
    $('#engravingOverlay').style.top = '52%';
    $('#engravingOverlay').style.left = '50%';
    fieldVisible('textField','text');
    fieldVisible('logoField','logo');
    fieldVisible('fontField','font');
    fieldVisible('colorField','color');
    fieldVisible('positionField','position');
    fieldVisible('positionXField','position');
    fieldVisible('sizeField','size');
    $('#customModal').classList.add('open');
    document.body.classList.add('locked');
    $('#modalClose').focus();
  }
  function closeCustomizer() {
    $('#customModal').classList.remove('open');
    document.body.classList.remove('locked');
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    logoObjectUrl = null;
    selectedProduct = null;
  }
  function updatePreview() {
    const text = $('#customText').value.trim();
    const el = $('#textPreview');
    el.textContent = text || 'Seu nome';
    const font = $('#customFont').value;
    el.style.fontFamily = font==='sans' ? 'var(--sans)' : font==='script' ? 'cursive' : 'var(--serif)';
    el.style.fontSize = $('#customSize').value + 'px';
    el.style.color = $('#customColor').value;
    $('#engravingOverlay').style.top = $('#customPosition').value + '%';
    $('#engravingOverlay').style.left = $('#customPositionX').value + '%';
  }
  function addToQuote() {
    if (!selectedProduct) return;
    if (quoteItems.length >= 15) {
      toast('Sua lista chegou ao limite de 15 itens. Envie esta solicitação antes de adicionar mais.');
      return;
    }
    const file = $('#customLogo').files[0];
    const quantity = Math.min(999,Math.max(1,Number.parseInt($('#customQuantity').value,10)||1));
    quoteItems.push({
      key:crypto.randomUUID(),
      productId:selectedProduct.id,
      name:selectedProduct.name,
      priceLabel:selectedProduct.price_label || money(selectedProduct.price),
      quantity,
      text:$('#customText').value.trim() || 'A combinar',
      font:$('#customFont').selectedOptions[0].text,
      color:$('#customColor').selectedOptions[0].text,
      size:$('#customSize').value,
      positionY:$('#customPosition').value,
      positionX:$('#customPositionX').value,
      logoFilename:file ? file.name : ''
    });
    renderQuote();
    closeCustomizer();
    toast('Peça adicionada à sua seleção.');
  }
  function renderQuote() {
    $('#quoteCount').textContent = String(quoteItems.length);
    $('#quoteItems').innerHTML = quoteItems.length ? quoteItems.map(item => {
      const details = 'Quantidade: '+item.quantity+'\\nTexto: '+item.text+'\\nLetra: '+item.font+' · Tom: '+item.color+'\\nComposição: tamanho '+item.size+' · altura '+item.positionY+' · largura '+item.positionX+(item.logoFilename?'\\nArte para anexar: '+item.logoFilename:'');
      return '<article class="quote-item"><div><h3>'+escapeHtml(item.name)+'</h3><p>'+escapeHtml(details)+'\\n'+escapeHtml(item.priceLabel)+'</p></div><button class="quote-remove" type="button" data-remove-quote="'+escapeHtml(item.key)+'">Remover</button></article>';
    }).join('') : '<div class="catalog-empty">Sua seleção ainda está vazia. Explore a coleção e adicione as peças que deseja consultar.</div>';
  }
  function openQuote() {
    renderQuote();
    $('#quoteModal').classList.add('open');
    document.body.classList.add('locked');
    $('#quoteClose').focus();
  }
  function closeQuote() {
    $('#quoteModal').classList.remove('open');
    document.body.classList.remove('locked');
  }
  function buildQuoteMessage() {
    const lines = [
      'Olá! Gostaria de solicitar um orçamento para os itens abaixo.',
      '',
      ...quoteItems.map((item,index) => [
        (index+1)+') '+item.name,
        'Quantidade: '+item.quantity,
        'Preço exibido: '+item.priceLabel,
        'Texto: '+item.text,
        'Estilo da letra: '+item.font,
        'Tom ilustrativo: '+item.color,
        'Tamanho/posição de referência: '+item.size+' / altura '+item.positionY+' / largura '+item.positionX,
        'Arquivo de referência: '+(item.logoFilename ? item.logoFilename+' (vou anexar na conversa)' : 'não anexado')
      ].join('\\n'))
    ];
    lines.push('','Por favor, confirmem disponibilidade, preço final, prazo e a arte antes da produção.');
    return lines.join('\\n');
  }
  async function sendQuote() {
    if (!quoteItems.length) {
      toast('Adicione ao menos uma peça à sua seleção.');
      return;
    }
    const message = buildQuoteMessage();
    const digits = String(settings.whatsapp_number || '').replace(/\\D/g,'');
    if (digits.length >= 10) {
      window.open('https://wa.me/'+digits+'?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
      toast('Abrindo o WhatsApp com sua lista de orçamento.');
      return;
    }
    const instagram = validExternalUrl(settings.instagram_url,'https://www.instagram.com/');
    window.open(instagram,'_blank','noopener,noreferrer');
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        copied = true;
      }
    } catch (error) { console.warn('Área de transferência indisponível',error); }
    toast(copied ? 'Resumo copiado. Cole no direct e anexe os arquivos de arte, se houver.' : 'Envie os detalhes da sua seleção pelo direct.');
  }
  $('#filters').addEventListener('click',event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    activeCategory = button.dataset.category;
    renderProducts();
  });
  $('#search').addEventListener('input',renderProducts);
  $('#products').addEventListener('click',event => {
    const button = event.target.closest('[data-product]');
    if (!button) return;
    const product = products.find(p => String(p.id)===button.dataset.product);
    if (product) openCustomizer(product);
  });
  $('#customText').addEventListener('input',updatePreview);
  ['customFont','customColor','customSize','customPosition','customPositionX'].forEach(id => $('#'+id).addEventListener('input',updatePreview));
  $('#customQuantity').addEventListener('change',event => {
    const value=Math.min(999,Math.max(1,Number.parseInt(event.target.value,10)||1));
    event.target.value=String(value);
  });
  $('#customLogo').addEventListener('change',event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type) || file.size > 5*1024*1024) {
      event.target.value = '';
      toast('Escolha PNG, JPG, WEBP ou SVG de até 5 MB.');
      return;
    }
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    logoObjectUrl = URL.createObjectURL(file);
    $('#logoPreview').src = logoObjectUrl;
    $('#logoPreview').hidden = false;
  });
  $('#requestButton').addEventListener('click',addToQuote);
  $('#quoteOpen').addEventListener('click',openQuote);
  $('#quoteClose').addEventListener('click',closeQuote);
  $('#sendQuoteButton').addEventListener('click',sendQuote);
  $('#quoteItems').addEventListener('click',event => {
    const button=event.target.closest('[data-remove-quote]');
    if(!button)return;
    quoteItems=quoteItems.filter(item=>item.key!==button.dataset.removeQuote);
    renderQuote();
  });
  $('#quoteModal').addEventListener('click',event => { if(event.target.id==='quoteModal') closeQuote(); });
  $('#modalClose').addEventListener('click',closeCustomizer);
  $('#customModal').addEventListener('click',event => { if(event.target.id==='customModal') closeCustomizer(); });
  document.addEventListener('keydown',event => { if(event.key==='Escape' && $('#customModal').classList.contains('open')) closeCustomizer(); else if(event.key==='Escape' && $('#quoteModal').classList.contains('open')) closeQuote(); });
  $('#menuToggle').addEventListener('click',() => {
    const nav = $('#mainNav');
    const open = nav.classList.toggle('open');
    $('#menuToggle').setAttribute('aria-expanded',String(open));
    $('#menuToggle').textContent = open ? '×' : '☰';
  });
  $('#mainNav').addEventListener('click',event => {
    if (event.target.closest('a') || event.target.closest('#quoteOpen')) {
      $('#mainNav').classList.remove('open');
      $('#menuToggle').setAttribute('aria-expanded','false');
      $('#menuToggle').textContent = '☰';
    }
  });
  loadData();
})();