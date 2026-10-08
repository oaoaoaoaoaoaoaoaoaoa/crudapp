<?php
include 'db.php';
if (!empty($_POST["action"])) {
    if ($_POST["action"]== "checkout"){

    $sth = $pdo->prepare("INSERT INTO `customer` SET `FIO` = :fio, `Telephone` = :phone");
    $sth->execute(array('fio' => $_POST["name"], 'phone' => $_POST["number"]));
 
// Получаем id вставленной записи
$insert_id = $pdo->lastInsertId();
session_start();
$temp=$_SESSION['cart'];
$cstrok = '';
$sum = 0;
          foreach($temp as $id=>$kol){
          	$cstrok = $cstrok . $id . 'x' . $kol . ';';
          	$sth = $pdo->prepare("SELECT `Cost` FROM `tovar` WHERE `Codetovara` = ?");
            $sth->execute(array($id));
            $value = $sth->fetch(PDO::FETCH_COLUMN);
            $sum += $value * $kol;
          }

$sth = $pdo->prepare("INSERT INTO `list1` SET `customerid` = :cid, `amount` = :amount, `tovari` = :tovari");
$sth->execute(array('cid' => $insert_id, 'amount' => $sum, 'tovari' => $cstrok));
echo "УСПЕХ";
    }    
} else {  
 echo '   <form action="checkout.php" method="post">
 <p>Ваше имя: <input type="text" name="name" /></p>
 <p>Ваш номер: <input type="text" name="number" /></p>
 <input type="hidden" name="action" value="checkout" />
 <p><input type="submit" /></p>
</form>';
}
?>