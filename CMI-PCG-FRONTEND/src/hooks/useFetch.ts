import { useState, useEffect } from 'react';

interface UseFetchResult<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
}

/**
 * Hook customizado para fetch de dados com loading e error states
 * 
 * @example
 * const { data, loading, error, refetch } = useFetch<Paciente[]>(
 *   () => pacientesAPI.getAll()
 * );
 */
export function useFetch<T>(
    fetchFunction: () => Promise<any>,
    dependencies: any[] = []
): UseFetchResult<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetchFunction();
            setData(response.data);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies);

    return { data, loading, error, refetch: fetchData };
}