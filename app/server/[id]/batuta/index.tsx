import { View } from 'react-native';

import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { useTheme } from '../../../../src/lib/theme';

// Placeholder — Batuta (docs/prd/mobile-app.md §3, item 2) ainda não
// foi implementado no mobile. Rota /batuta já mapeada no
// mobile-api-reference.md §6.1.
export default function BatutaScreen() {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <EmptyState
        icon="git-network-outline"
        title="Batuta ainda não chegou aqui"
        subtitle="Visualização de atividades e orquestração multi-agente — próximo passo do roadmap."
      />
    </View>
  );
}
