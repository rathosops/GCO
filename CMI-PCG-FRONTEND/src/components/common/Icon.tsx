/**
 * Icon Component
 * Wrapper para ícones Lucide com suporte a tooltip (title)
 *
 * Resolve o problema de TypeScript onde LucideProps não inclui 'title'
 * mas queremos mostrar tooltips nos ícones.
 *
 * @module components/common/Icon
 */

import { forwardRef, type SVGProps } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';

// ============================================
// Tipos
// ============================================

interface IconProps extends Omit<LucideProps, 'ref'> {
  /** O componente de ícone Lucide a ser renderizado */
  icon: LucideIcon;
  /** Texto do tooltip (HTML title attribute) */
  title?: string;
  /** Classes CSS adicionais para o wrapper */
  wrapperClassName?: string;
}

// ============================================
// Componente
// ============================================

/**
 * Wrapper para ícones Lucide com suporte a tooltip
 *
 * @example
 * // Uso básico
 * <Icon icon={Settings} className="h-5 w-5" />
 *
 * @example
 * // Com tooltip
 * <Icon icon={Settings} className="h-5 w-5" title="Configurações" />
 *
 * @example
 * // Com cor customizada
 * <Icon icon={Check} className="h-5 w-5" color="green" />
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ icon: IconComponent, title, wrapperClassName, ...props }, ref) => {
    // Se não tem title, renderiza o ícone diretamente
    if (!title) {
      return <IconComponent ref={ref} {...props} />;
    }

    // Se tem title, envolve em um span para o tooltip funcionar
    return (
      <span title={title} className={wrapperClassName}>
        <IconComponent ref={ref} {...props} />
      </span>
    );
  }
);

Icon.displayName = 'Icon';

// ============================================
// Componente alternativo: IconButton
// ============================================

interface IconButtonProps extends Omit<LucideProps, 'ref'> {
  /** O componente de ícone Lucide */
  icon: LucideIcon;
  /** Texto do tooltip */
  title?: string;
  /** Callback ao clicar */
  onClick?: () => void;
  /** Desabilitar o botão */
  disabled?: boolean;
  /** Classes CSS para o botão */
  buttonClassName?: string;
}

/**
 * Botão com ícone e suporte a tooltip
 *
 * @example
 * <IconButton
 *   icon={Trash2}
 *   title="Excluir item"
 *   onClick={handleDelete}
 *   className="h-4 w-4 text-red-500"
 * />
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: IconComponent, title, onClick, disabled, buttonClassName, ...iconProps }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={buttonClassName}
        aria-label={title}
      >
        <IconComponent {...iconProps} />
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

// ============================================
// Export default e tipos
// ============================================

export type { IconProps, IconButtonProps };
export default Icon;