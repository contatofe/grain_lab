# Grain Lab

Processador de imagens com grão procedural, ajustes de luz, três presets e cores duotone. Não exige instalação nem dependências.

## Abrir

Abra `index.html` diretamente em um navegador moderno. Se preferir um endereço local, execute nesta pasta:

```sh
python3 -m http.server 8000
```

Depois, abra http://localhost:8000. Encerre o servidor com Ctrl+C.

## Usar

1. Carregue ou arraste uma imagem PNG, JPG, WebP ou AVIF (até 40 MB e 60 megapixels). SVG e imagens animadas não são aceitos.
2. Escolha Poeira, Erosão ou Orgânico e ajuste luz, matéria e duotone. A textura permanece estável durante os ajustes; “Nova textura” troca sua semente.
3. Compare com a imagem original e exporte o tratamento em PNG, com fundo sólido ou transparente.

A exportação preserva a proporção e oferece 1024, 2048 ou 4096 pixels no lado maior. A opção “Original” usa o tamanho original limitado a 4096 pixels no lado maior. A prévia usa 900 pixels; o tamanho relativo do grão é preservado na exportação.

As imagens são processadas no navegador, sem envio a servidores. Presets pessoais são salvos no armazenamento deste navegador e estão disponíveis apenas na interface desktop; sua persistência depende das permissões do navegador.

O efeito usa processamento procedural, sem IA e sem segmentação ou remoção automática de fundo. A opção transparente torna o espaço entre os grãos transparente; fundos claros da imagem também recebem textura. Imagens com luz marcada e fundo escuro tendem a produzir resultados mais próximos das demonstrações.
