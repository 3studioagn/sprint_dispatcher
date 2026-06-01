/**
 * Identidade de marca do Operator Agent (BL-C5-005, Sessão 49, ADR-028).
 *
 * Nome de exibição único — Start Menu, títulos de janela, tray, diálogos,
 * balloons e o wizard de first-run. Centralizado aqui para não espalhar o
 * literal pelo código (e facilitar futuros rebrands). O `productName` do
 * `electron-builder.yml` deve casar com {@link APP_DISPLAY_NAME}.
 *
 * **Rename (decisão Renan, Sessão 49):** o produto foi renomeado de
 * "Sprint Operator Agent" para **"Metas - Desenhistas"**. `appId`, artefatos
 * e a pasta de dados em `C:\ProgramData\` seguem o mesmo nome.
 *
 * Vive em `shared/` (não em `main/`) porque o renderer do wizard também exibe
 * o nome — e é puro (zero Electron / zero Node), seguro em ambos os processos.
 *
 * @see DECISIONS.md ADR-028
 */

/** Nome de exibição do app (Start Menu, títulos, tray, diálogos, wizard). */
export const APP_DISPLAY_NAME = 'Metas - Desenhistas';

/**
 * Nome da pasta de dados em `C:\ProgramData\<APP_DATA_DIR_NAME>\` (Windows).
 * Coincide com {@link APP_DISPLAY_NAME} por coerência — o que o TI vê no Start
 * Menu é o que vê em `ProgramData`. Ver `main/paths.ts#getAgentDataDir`.
 */
export const APP_DATA_DIR_NAME = APP_DISPLAY_NAME;

/**
 * Nome do valor sob `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` que
 * dá auto-start ao Agent (BL-C5-003).
 *
 * ⚠️ O hook NSIS (`build/installer.nsh`) e o auto-registro defensivo no main
 * (`main/services/autoStart.ts`) **DEVEM** usar exatamente este nome — senão
 * surgem DUAS entradas de auto-start (uma escrita pelo instalador, outra pelo
 * app no boot). Ver ADR-028.
 */
export const AUTO_START_REGISTRY_VALUE = APP_DISPLAY_NAME;
