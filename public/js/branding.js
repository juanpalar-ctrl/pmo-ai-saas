/**
 * public/js/branding.js
 * Carga configuración de branding desde API e inyecta CSS variables
 */

(function() {
  'use strict';

  // Colores por defecto
  const DEFAULT_BRANDING = {
    primaryColor: '#17B8A0',
    secondaryColor: '#0B7B8C',
    accentColor: '#9ED900',
    logoUrl: '/uploads/logos/lara-logo.png'
  };

  /**
   * Inyecta CSS variables en el documento
   */
  function injectCSSVariables(branding) {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', branding.primaryColor);
    root.style.setProperty('--color-secondary', branding.secondaryColor);
    root.style.setProperty('--color-accent', branding.accentColor);
    console.log('✅ CSS variables inyectadas:', branding);
  }

  /**
   * Actualiza logo en todas las imágenes con data-logo
   */
  function updateLogos(logoUrl) {
    const logos = document.querySelectorAll('[data-logo]');
    logos.forEach(img => {
      img.src = logoUrl;
      img.alt = 'LARA Logo';
    });
    console.log('✅ Logo actualizado:', logoUrl);
  }

  /**
   * Carga branding desde API
   */
  async function loadBranding() {
    try {
      const response = await fetch('/api/branding');
      if (!response.ok) throw new Error('API error');
      
      const json = await response.json();
      const branding = json.data || json;
      
      if (!branding.primaryColor) {
        console.warn('⚠️ Respuesta inválida, usando defaults');
        return DEFAULT_BRANDING;
      }
      
      console.log('✅ Branding cargado de API');
      return branding;
    } catch (error) {
      console.error('⚠️ Error cargando branding:', error.message);
      console.log('📌 Usando colores por defecto');
      return DEFAULT_BRANDING;
    }
  }

  /**
   * Inicializa el sistema de branding
   */
  async function init() {
    console.log('🎨 Inicializando branding...');
    const branding = await loadBranding();
    injectCSSVariables(branding);
    updateLogos(branding.logoUrl);
  }

  // Ejecutar cuando DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
