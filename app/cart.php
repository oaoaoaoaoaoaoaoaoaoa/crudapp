<!DOCTYPE html>
<?php
include 'db.php';
?>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Корзина</title>
</head>
<body>
<?php session_start();
if (!isset($_SESSION['cart'])):?>

<h2>Ваша корзина пуста</h2>

<?php else :?>
<?php $sum = 0; ?>
<table>
    <tr>
        <td>id</td>
        <td>количество</td>
        <td>Удалить</td>
    </tr>
    <?php $temp=$_SESSION['cart'];
          foreach($temp as $id=>$kol): ?>
           <tr id="<?=$id?>">
                <td>id товара: <?=$id?></td>
                <td><input type="number" class="count-product" id="<?=$id?>" value="<?=$kol?>"></td>
                <td>Стоимость:
                 <?php
$sth = $pdo->prepare("SELECT `Cost` FROM `tovar` WHERE `Codetovara` = ?");
$sth->execute(array($id));
$value = $sth->fetch(PDO::FETCH_COLUMN);
echo $value * $kol;
$sum += $value * $kol;
?>    
</td>
 <td><button class="btn btn-default btn-del" id="<?=$id?>">Удалить</button></td>
            </tr>
          <?php endforeach; ?>
</table>
<p> Сумма: <?php echo $sum; ?></p>          
<?php endif; ?>   
  <p><a href="checkout.php">Оформить</a></p>
  <p><a href="index.php">Начальная страница(добавление/удаление товара)</a></p>
  <p><a href="tovari.php">Список товаров</a></p>
</body>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<script>
    //изменение количества
        $('.count-product').change(function () { //изменение содержимого инпута     
        var col = $(this).val(); //получаем количество
        if (col<1){ col = 1; $(this).val(1); } //если ввели меньше 1 установим 1
        var id = $(this).attr('id'); //получаем id товара
            $.ajax({//аякс-запрос
            type: "POST",//метод
            url: 'cartamount.php',//куда передаем
            data: {col_tov: col, id_tov: id},//данные
            success: function() {//получаем результат
               //тут можно пересчитать сумму
                }
            });
        });
        //удаление товара
        $('.btn-del').click(function () { //клик на кнопку     
        var id = $(this).attr('id'); //получаем id товара
            $.ajax({//аякс-запрос
            type: "POST",//метод
            url: 'cartdel.php',//куда передаем
            data: {id_tov: id},//данные
            success: function(data) {//получаем результат
                    //тут можно пересчитать сумму
                    $('tr#'+id).css('display', 'none');//скрываем строку таблицы
                }
            });
        });
</script>
</html>