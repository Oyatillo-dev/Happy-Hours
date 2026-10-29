import { useQuery } from '@tanstack/react-query';
import { partnerApi } from '../../api/endpoints';

export const usePartner = () => useQuery({ queryKey: ['partner', 'profile'], queryFn: partnerApi.get });
export const useLocations = () =>
  useQuery({ queryKey: ['partner', 'locations'], queryFn: partnerApi.locations, select: (d) => d.items });
export const useTemplates = () =>
  useQuery({ queryKey: ['partner', 'templates'], queryFn: partnerApi.templates, select: (d) => d.items });
