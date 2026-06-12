// The "Options" fieldset: workflow name, complexity, and comment language.
export default function GenerationOptions({ t, wfName, setWfName, complexity, setComplexity, lang, setLang, langTouchedRef }) {
  return (
    <fieldset className="field-group">
          <legend className="field-label">{t('options')}</legend>
          <div className="grid-2">
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="field-label" htmlFor="wfName">{t('wfName')}</label>
              <input id="wfName" type="text" value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="My Workflow" />
            </div>
            <div>
              <label className="field-label" htmlFor="complexity">{t('complexity')}</label>
              <select id="complexity" value={complexity} onChange={(e) => setComplexity(e.target.value)}>
                <option value="simple">{t('complexitySimple')}</option>
                <option value="medium">{t('complexityMedium')}</option>
                <option value="complex">{t('complexityComplex')}</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="commentLang">{t('commentLang')}</label>
              <select id="commentLang" value={lang} onChange={(e) => { langTouchedRef.current = true; setLang(e.target.value) }}>
                <option value="id">{t('optIndonesian')}</option>
                <option value="en">{t('optEnglish')}</option>
              </select>
            </div>
          </div></fieldset>
  )
}
